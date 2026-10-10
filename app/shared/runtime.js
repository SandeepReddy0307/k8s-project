'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const prometheus = require('prom-client');
const { Pool } = require('pg');
function required(name) {
  const value = process.env[name];
  if (!value || /^(postgres|dev-secret-change-me|change-me|unset)$/.test(value)) throw new Error(`Missing or unsafe configuration: ${name}`);
  return value;
}
function database() {
  const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: true, ca: fs.readFileSync(required('DB_CA_FILE'), 'utf8') } : false;
  return new Pool({host:required('DB_HOST'),port:Number(required('DB_PORT')),user:required('DB_USER'),password:required('DB_PASSWORD'),database:required('DB_NAME'),ssl,max:10,idleTimeoutMillis:30000,connectionTimeoutMillis:5000,statement_timeout:5000});
}
function identity(req, res, next) {
  if(req.method==='POST' && ['/login','/register','/logout','/api/auth/login','/api/auth/register','/api/auth/logout'].includes(req.path)) return next();
  const cookie = (req.headers.cookie || '').split(';').map(c=>c.trim()).find(c=>c.startsWith('streamflix_session='));
  const raw = req.headers.authorization?.replace(/^Bearer /, '') || cookie?.slice('streamflix_session='.length);
  if (!raw) return next();
  try {
    req.identity = jwt.verify(raw, required('JWT_PUBLIC_KEY'), { algorithms:['RS256'],issuer:'streamflix-auth',audience:'streamflix' });
    req.accessToken = raw;
  } catch { return res.status(401).json({error:'session-expired'}); }
  next();
}
function requireIdentity(req,res,next) { return req.identity ? next() : res.status(401).json({error:'authentication-required'}); }
function createApp(name, {publicApp=false}={}) {
  const app = express();
  app.disable('x-powered-by');
  // One explicitly trusted ingress hop; never trust arbitrary proxy chains.
  app.set('trust proxy', 1);
  app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],imgSrc:["'self'","data:"],mediaSrc:["'self'","https://storage.googleapis.com"],connectSrc:["'self'"],upgradeInsecureRequests:process.env.COOKIE_SECURE==='true'?[]:null}}}));
  const registry = new prometheus.Registry();
  prometheus.collectDefaultMetrics({register:registry});
  const duration = new prometheus.Histogram({name:'http_request_duration_seconds',help:'HTTP latency',labelNames:['service','method','route','status'],registers:[registry]});
  const requests = new prometheus.Counter({name:'http_requests_total',help:'HTTP requests',labelNames:['service','method','route','status'],registers:[registry]});
  app.use((req,res,next)=>{
    req.requestId = /^[a-zA-Z0-9-]{1,64}$/.test(req.headers['x-request-id'] || '') ? req.headers['x-request-id'] : crypto.randomUUID();
    res.set('X-Request-ID',req.requestId);
    const finish = duration.startTimer();
    res.on('finish',()=>{
      if(['/health','/ready','/metrics'].includes(req.path)) return;
      const labels={service:name,method:req.method,route:req.route?.path || 'unmatched',status:String(res.statusCode)};
      finish(labels); requests.inc(labels);
      console.log(JSON.stringify({time:new Date().toISOString(),level:'info',service:name,requestId:req.requestId,method:req.method,route:labels.route,status:res.statusCode}));
    }); next();
  });
  app.get('/health',(_req,res)=>res.json({status:'ok'}));
  app.get('/metrics',async(_req,res)=>{res.type(registry.contentType).send(await registry.metrics());});
  app.use(express.json({limit:'32kb'}));
  if(!publicApp) app.use(identity);
  app.use((req,res,next)=>{
    if(!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.cookie?.includes('streamflix_session=') && req.headers.origin !== required('PUBLIC_ORIGIN')) return res.status(403).json({error:'invalid-origin'});
    next();
  });
  // Express 4 does not forward rejected async handlers automatically.
  for(const method of ['get','post','put','patch','delete']) {
    const original=app[method].bind(app);
    app[method]=(path,...handlers)=>original(path,...handlers.map(h=>typeof h==='function' && h.constructor.name==='AsyncFunction' ? (req,res,next)=>Promise.resolve(h(req,res,next)).catch(next):h));
  }
  function start(cleanups=[]) {
    app.use((_req,res)=>res.status(404).json({error:'not-found'}));
    app.use((error,req,res,_next)=>{
      console.error(JSON.stringify({level:'error',service:name,requestId:req.requestId,code:error.code || 'internal-error'}));
      res.status(error.status===400?400:503).json({error:error.status===400?'invalid-request':'service-unavailable',requestId:req.requestId});
    });
    const server=app.listen(Number(process.env.PORT || 8080),'0.0.0.0');
    server.requestTimeout=15000; server.headersTimeout=20000;
    process.once('SIGTERM',()=>{const timeout=setTimeout(()=>process.exit(1),25000);timeout.unref();server.close(async()=>{await Promise.allSettled(cleanups.map(fn=>fn()));process.exit(0);});});
    return server;
  }
  return {app,registry,start};
}
module.exports={required,database,identity,requireIdentity,createApp};

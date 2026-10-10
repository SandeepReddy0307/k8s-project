require('../../shared/tracing');
const {createApp,required,requireIdentity}=require('../../shared/runtime');
const {distributedLimit}=require('../../shared/rate-limit');
const {Readable}=require('node:stream');
const {app,start}=createApp('api-gateway');
const limiter=distributedLimit('gateway',240,60);
app.get('/ready',(_req,res)=>res.status(limiter.isReady()?200:503).json({status:limiter.isReady()?'ready':'cache-unavailable'}));
app.use('/api',limiter);
const routes={auth:'AUTH_URL',catalog:'CATALOG_URL',users:'USER_URL',search:'SEARCH_URL',recommendations:'RECO_URL',notifications:'NOTIF_URL',billing:'BILLING_URL',activity:'ACTIVITY_URL',admin:'ADMIN_URL'};
for(const [name,env] of Object.entries(routes)){
 const target=new URL(required(env));
 if(!['http:','https:'].includes(target.protocol)||target.username||target.password)throw new Error('Invalid service endpoint');
 app.use(`/api/${name}`,(req,res,next)=>{
  const publicRead=['catalog','search','activity'].includes(name)&&req.method==='GET';
  if(name==='auth'||publicRead)return next();return requireIdentity(req,res,next);
 },(req,res,next)=>{
  (async()=>{
   const headers={'x-request-id':req.requestId};
   for(const key of ['origin','cookie','traceparent','tracestate','baggage','idempotency-key'])if(req.headers[key])headers[key]=req.headers[key];
   if(req.accessToken)headers.authorization=`Bearer ${req.accessToken}`;
   const options={method:req.method,headers,redirect:'manual',signal:AbortSignal.timeout(5000)};
   if(!['GET','HEAD'].includes(req.method)){headers['content-type']='application/json';options.body=JSON.stringify(req.body||{});}
   // Concatenation preserves the configured origin even for a path beginning //.
   const upstream=await fetch(`${target.origin}${req.url}`,options);
   res.status(upstream.status);
   for(const key of ['content-type','cache-control'])if(upstream.headers.has(key))res.setHeader(key,upstream.headers.get(key));
   const cookies=upstream.headers.getSetCookie();if(cookies.length)res.setHeader('set-cookie',cookies);
   if(!upstream.body)return res.end();
   const stream=Readable.fromWeb(upstream.body);stream.on('error',()=>res.destroy());stream.pipe(res);
  })().catch(next);
 });
}
start();

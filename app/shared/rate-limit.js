'use strict';
const {createClient}=require('redis');const {createHash}=require('node:crypto');const {required}=require('./runtime');
function distributedLimit(prefix,limit,seconds){
 const redis=createClient({url:required('REDIS_URL'),password:required('REDIS_PASSWORD')});redis.on('error',()=>{});
 const connecting=redis.connect();connecting.catch(()=>{});
 const script="local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n";
 const middleware=(req,res,next)=>{
  const key=`limit:${prefix}:${createHash('sha256').update(req.ip).digest('hex')}`;
  connecting.then(()=>redis.eval(script,{keys:[key],arguments:[String(seconds)]})).then(n=>{
   if(n>limit){res.set('Retry-After',String(seconds));return res.status(429).json({error:'too-many-requests'});}next();
  }).catch(next);
 };
 middleware.isReady=()=>redis.isReady;
 return middleware;
}
module.exports={distributedLimit};

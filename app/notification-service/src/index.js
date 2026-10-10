require('../../shared/tracing');
const {createApp,required,requireIdentity}=require('../../shared/runtime');const {createClient}=require('redis');
const {app,start}=createApp('notification-service');const redis=createClient({url:required('REDIS_URL'),password:required('REDIS_PASSWORD')});redis.on('error',()=>{});
app.get('/ready',(_req,res)=>res.status(redis.isReady?200:503).json({status:redis.isReady?'ready':'connecting'}));
app.use(requireIdentity);
app.post('/notify',async(req,res)=>{const message=req.body.message;if(typeof message!=='string'||!message.trim()||message.length>500)return res.status(400).json({error:'invalid-message'});const key=`notifications:${req.identity.sub}`;await redis.lPush(key,JSON.stringify({message,at:new Date().toISOString()}));await redis.lTrim(key,0,49);await redis.expire(key,2592000);res.status(201).json({queued:true});});
app.get('/notify',async(req,res)=>res.json((await redis.lRange(`notifications:${req.identity.sub}`,0,49)).map(JSON.parse)));
redis.connect().then(()=>start([()=>redis.quit()])).catch(()=>process.exit(1));

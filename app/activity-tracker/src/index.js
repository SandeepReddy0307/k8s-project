require('../../shared/tracing');
const {createApp,required}=require('../../shared/runtime');const {Kafka}=require('kafkajs');const {createClient}=require('redis');const prometheus=require('prom-client');
const {app,registry,start}=createApp('activity-tracker');const redis=createClient({url:required('REDIS_URL'),password:required('REDIS_PASSWORD')});redis.on('error',()=>{});
const kafka=new Kafka({clientId:'activity-tracker',brokers:required('KAFKA_BROKERS').split(','),ssl:process.env.KAFKA_SSL==='true',...(process.env.KAFKA_USERNAME?{sasl:{mechanism:'plain',username:required('KAFKA_USERNAME'),password:required('KAFKA_PASSWORD')}}:{})});const consumer=kafka.consumer({groupId:'activity-tracker-v2'});let consumerReady=false;
const consumed=new prometheus.Counter({name:'activity_events_consumed_total',help:'Accepted unique events',registers:[registry]});
app.get('/ready',(_req,res)=>res.status(redis.isReady&&consumerReady?200:503).json({status:redis.isReady&&consumerReady?'ready':'connecting'}));
app.get('/views/:title',async(req,res)=>res.json({title:req.params.title,views:Number(await redis.get(`views:${req.params.title}`)||0)}));
// Deduplication and increment are atomic, including across consumer crashes/replays.
const script="if redis.call('SET', KEYS[1], '1', 'NX', 'EX', 604800) then return redis.call('INCR', KEYS[2]) else return -1 end";
async function connect(){await redis.connect();await consumer.connect();await consumer.subscribe({topic:required('KAFKA_TOPIC'),fromBeginning:true});await consumer.run({eachMessage:async({message})=>{const event=JSON.parse(message.value.toString());if(typeof event.eventId!=='string'||typeof event.title!=='string')throw new Error('invalid-event');const result=await redis.eval(script,{keys:[`event:${event.eventId}`,`views:${event.title}`],arguments:[]});if(result!==-1)consumed.inc();}});consumerReady=true;}
start([()=>consumer.disconnect(),()=>redis.quit()]);connect().catch(()=>process.exit(1));

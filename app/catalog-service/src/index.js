require('../../shared/tracing');
const {createApp,database,required,requireIdentity}=require('../../shared/runtime');
const {Kafka}=require('kafkajs');const {randomUUID}=require('node:crypto');
const {app,start}=createApp('catalog-service');const pool=database();
const kafka=new Kafka({clientId:'catalog-service',brokers:required('KAFKA_BROKERS').split(','),retry:{retries:8},ssl:process.env.KAFKA_SSL==='true',...(process.env.KAFKA_USERNAME?{sasl:{mechanism:'plain',username:required('KAFKA_USERNAME'),password:required('KAFKA_PASSWORD')}}:{})});
const producer=kafka.producer({idempotent:true,maxInFlightRequests:1});let connected=false;
async function connect(){try{await producer.connect();connected=true;}catch{connected=false;setTimeout(connect,5000).unref();}}connect();
app.get('/ready',async(_req,res)=>{await pool.query('SELECT 1 FROM titles LIMIT 1');res.status(connected?200:503).json({status:connected?'ready':'event-broker-unavailable'});});
app.get('/titles',async(req,res)=>{const {rows}=await pool.query('SELECT * FROM titles WHERE ($1::text IS NULL OR genre=$1) ORDER BY id',[req.query.genre||null]);res.json(rows);});
app.get('/titles/:id',async(req,res)=>{if(!/^\d+$/.test(req.params.id))return res.status(400).json({error:'invalid-title'});const {rows}=await pool.query('SELECT * FROM titles WHERE id=$1',[req.params.id]);res.status(rows.length?200:404).json(rows[0]||{error:'not-found'});});
app.post('/titles/:id/view',requireIdentity,async(req,res)=>{
 if(!/^\d+$/.test(req.params.id))return res.status(400).json({error:'invalid-title'});
 const {rows}=await pool.query('SELECT * FROM titles WHERE id=$1',[req.params.id]);if(!rows.length)return res.status(404).json({error:'not-found'});
 if(!connected)return res.status(503).json({error:'event-broker-unavailable'});
 const event={eventId:randomUUID(),title:rows[0].name,id:rows[0].id,at:new Date().toISOString()};
 await producer.send({topic:required('KAFKA_TOPIC'),messages:[{key:String(event.id),value:JSON.stringify(event)}]});
 res.json({viewed:event.title,eventPublished:true,eventId:event.eventId});
});
start([()=>producer.disconnect(),()=>pool.end()]);

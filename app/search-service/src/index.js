require('../../shared/tracing');
const {createApp,required}=require('../../shared/runtime');const {Client}=require('@elastic/elasticsearch');
const {app,start}=createApp('search-service');const es=new Client({node:required('ES_URL'),auth:{username:required('ES_USERNAME'),password:required('ES_PASSWORD')},requestTimeout:5000});
app.get('/ready',async(_req,res)=>{await es.ping();res.json({status:'ready'});});
app.get('/search',async(req,res)=>{const q=String(req.query.q||'').trim();if(q.length>100)return res.status(400).json({error:'query-too-long'});if(!q)return res.json([]);const result=await es.search({index:required('ES_INDEX'),size:30,query:{multi_match:{query:q,fields:['name^3','genre','description'],fuzziness:'AUTO'}}});res.json(result.hits.hits.map(h=>h._source));});
// Periodic reconciliation keeps the index consistent with the authoritative catalog.
async function sync(){try{const response=await fetch(`${required('CATALOG_URL')}/titles`,{signal:AbortSignal.timeout(5000)});if(!response.ok)throw new Error('catalog-unavailable');const titles=await response.json();const operations=titles.flatMap(t=>[{index:{_index:required('ES_INDEX'),_id:String(t.id)}},t]);if(operations.length){const result=await es.bulk({operations,refresh:true});if(result.errors)throw new Error('indexing-failed');}}catch{console.error(JSON.stringify({level:'warn',service:'search-service',event:'index-sync-failed'}));}}sync();const timer=setInterval(sync,60000);timer.unref();
start([()=>es.close()]);

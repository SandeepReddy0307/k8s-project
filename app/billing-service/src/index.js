require('../../shared/tracing');
const {createApp,database,required,requireIdentity}=require('../../shared/runtime');
const {app,start}=createApp('billing-service');const pool=database();required('PAYMENT_API_KEY');
app.get('/ready',async(_req,res)=>{await pool.query('SELECT 1 FROM subscriptions LIMIT 1');res.json({status:'ready'});});app.use(requireIdentity);
const plans={basic:799,standard:1299,premium:1799};
app.get('/subscription',async(req,res)=>{const {rows}=await pool.query('SELECT plan,status FROM subscriptions WHERE email=$1',[req.identity.email]);res.json(rows[0]||{plan:'free',status:'inactive',mode:'sandbox'});});
app.post('/subscribe',async(req,res)=>{const plan=req.body.plan;const key=req.headers['idempotency-key'];if(!Object.hasOwn(plans,plan)||typeof key!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(key))return res.status(400).json({error:'invalid-plan-or-idempotency-key'});
 const db=await pool.connect();try{await db.query('BEGIN');const existing=await db.query('SELECT response FROM billing_requests WHERE email=$1 AND key=$2 FOR UPDATE',[req.identity.email,key]);if(existing.rows.length){await db.query('COMMIT');return res.json(existing.rows[0].response);}
 const response={plan,amountCents:plans[plan],currency:'USD',status:'active',mode:'sandbox'};
 const claimed=await db.query('INSERT INTO billing_requests(email,key,response) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING key',[req.identity.email,key,response]);
 if(!claimed.rowCount){const prior=await db.query('SELECT response FROM billing_requests WHERE email=$1 AND key=$2',[req.identity.email,key]);await db.query('COMMIT');return res.json(prior.rows[0].response);}
 await db.query('INSERT INTO subscriptions(email,plan,status) VALUES($1,$2,$3) ON CONFLICT(email) DO UPDATE SET plan=EXCLUDED.plan,status=EXCLUDED.status',[req.identity.email,plan,'active']);await db.query('COMMIT');res.json(response);
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}});
start([()=>pool.end()]);

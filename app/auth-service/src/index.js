require('../../shared/tracing');
const {createApp,database,required,requireIdentity}=require('../../shared/runtime');
const {hashPassword,verifyPassword,validEmail,validPassword}=require('../../shared/security');
const jwt=require('jsonwebtoken');
const {distributedLimit}=require('../../shared/rate-limit');
const {app,start}=createApp('auth-service');
const pool=database(); const key=required('JWT_PRIVATE_KEY');
if(require('node:crypto').createPrivateKey(key).asymmetricKeyType!=='rsa') throw new Error('JWT signing key must be RSA');
const limiter=distributedLimit('auth',20,900);
app.get('/ready',async(_req,res)=>{await pool.query('SELECT 1 FROM users LIMIT 1');res.status(limiter.isReady()?200:503).json({status:limiter.isReady()?'ready':'cache-unavailable'});});
app.use(['/login','/register'],limiter);
app.post('/register',async(req,res)=>{
 const email=String(req.body.email || '').trim().toLowerCase();const {password}=req.body;
 if(!validEmail(email)||!validPassword(password)) return res.status(400).json({error:'Use a valid email and a password of 12–128 characters.'});
 const hash=await hashPassword(password);
 await pool.query('INSERT INTO users(email,password_hash) VALUES($1,$2) ON CONFLICT(email) DO NOTHING',[email,hash]);
 // Do not disclose whether an email is already registered.
 res.status(201).json({message:'Registration processed. You can now sign in.'});
});
app.post('/login',async(req,res)=>{
 const email=String(req.body.email || '').trim().toLowerCase();
 if(!validEmail(email)||typeof req.body.password!=='string'||req.body.password.length>128) return res.status(401).json({error:'Invalid email or password.'});
 const {rows}=await pool.query('SELECT id,email,password_hash FROM users WHERE email=$1',[email]);
 // Equal password work for unknown users prevents the obvious timing side channel.
 const hash=rows[0]?.password_hash || 'scrypt$00000000000000000000000000000000$'+'0'.repeat(128);
 const verified=await verifyPassword(req.body.password,hash);
 if(!rows[0]||!verified) return res.status(401).json({error:'Invalid email or password.'});
 const token=jwt.sign({email:rows[0].email},key,{algorithm:'RS256',subject:String(rows[0].id),issuer:'streamflix-auth',audience:'streamflix',expiresIn:'1h'});
 res.cookie('streamflix_session',token,{httpOnly:true,secure:process.env.COOKIE_SECURE==='true',sameSite:'strict',path:'/',maxAge:3600000});
 res.json({user:{email:rows[0].email}});
});
app.get('/me',requireIdentity,(req,res)=>res.json({user:{email:req.identity.email}}));
app.post('/logout',(_req,res)=>{res.clearCookie('streamflix_session',{httpOnly:true,secure:process.env.COOKIE_SECURE==='true',sameSite:'strict',path:'/'});res.status(204).end();});
start([()=>pool.end()]);

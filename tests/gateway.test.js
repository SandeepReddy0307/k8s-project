const {test}=require('node:test');const assert=require('node:assert/strict');const http=require('node:http');const {spawn}=require('node:child_process');const jwt=require('jsonwebtoken');
test('gateway forwards parsed JSON, verified identity and session cookies over HTTP',{timeout:60000},async()=>{
 const upstream=http.createServer((req,res)=>{let text='';req.on('data',chunk=>text+=chunk);req.on('end',()=>{res.setHeader('Content-Type','application/json');if(req.url==='/login')res.setHeader('Set-Cookie','streamflix_session=sample; HttpOnly; SameSite=Strict');res.end(JSON.stringify({path:req.url,body:text?JSON.parse(text):null,identity:req.headers.authorization,spoofed:req.headers['x-user-email']}));});});
 await new Promise(r=>upstream.listen(0,'127.0.0.1',r));const target=`http://127.0.0.1:${upstream.address().port}`;
 const reservation=http.createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const keys=require('node:crypto').generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});const key=keys.privateKey,base=`http://127.0.0.1:${port}`;
 const env={...process.env,PORT:String(port),JWT_PUBLIC_KEY:keys.publicKey,PUBLIC_ORIGIN:base,COOKIE_SECURE:'false'};
 for(const name of ['AUTH','CATALOG','USER','SEARCH','RECO','NOTIF','BILLING','ACTIVITY','ADMIN'])env[name+'_URL']=target;
 // This test isolates the reverse proxy; Redis rate limiting has a separate runtime dependency.
 const script=`const Module=require('module');const original=Module._load;Module._load=function(name,...args){if(name.endsWith('/shared/rate-limit'))return{distributedLimit:()=>Object.assign((_req,_res,next)=>next(),{isReady:()=>true})};return original.call(this,name,...args)};require('./app/api-gateway/src/index.js');`;
 const child=spawn(process.execPath,['-e',script],{env,stdio:'ignore'});
 try{
  let ready=false;for(let i=0;i<120;i++){try{if((await fetch(base+'/ready')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert(ready,'Gateway failed to start');
  const denied=await fetch(base+'/api/users/my-list');assert.equal(denied.status,401);
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'viewer@example.com',password:'unit-password'})});assert.equal(login.status,200);assert(login.headers.get('set-cookie').includes('HttpOnly'));const data=await login.json();assert.equal(data.path,'/login');assert.equal(data.body.email,'viewer@example.com');
  const token=jwt.sign({email:'viewer@example.com'},key,{algorithm:'RS256',issuer:'streamflix-auth',audience:'streamflix',subject:'1'});
  const result=await fetch(base+'/api/users/profile',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,'X-User-Email':'other@example.com'},body:JSON.stringify({display_name:'Viewer'})});const response=await result.json();assert.equal(response.path,'/profile');assert.equal(response.body.display_name,'Viewer');assert.equal(response.identity,`Bearer ${token}`);assert.equal(response.spoofed,undefined);
  assert.equal((await fetch(base+'/api/catalog/titles')).status,200);
 }finally{child.kill('SIGTERM');await new Promise(r=>upstream.close(r));}
});

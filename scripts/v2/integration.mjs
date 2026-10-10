// Isolated Docker infrastructure + real auth/user/billing/gateway HTTP integration.
// No Kubernetes commands. No existing containers or volumes are touched.
import {spawn,spawnSync} from 'node:child_process';import {randomBytes,generateKeyPairSync} from 'node:crypto';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import pg from 'pg';
const run=(args)=>{const r=spawnSync('docker',args,{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr||'docker-command-failed');return r.stdout.trim();};
const suffix=randomBytes(4).toString('hex'),containers=[],children=[],folder=await mkdtemp(path.join(os.tmpdir(),'streamflix-test-'));const password=randomBytes(32).toString('hex');
let admin;
try{
 const envFile=path.join(folder,'postgres.env');await writeFile(envFile,`POSTGRES_USER=test_admin\nPOSTGRES_PASSWORD=${password}\n`,{mode:0o600});
 const dbName=`streamflix-db-test-${suffix}`;run(['run','-d','--name',dbName,'--env-file',envFile,'-p','127.0.0.1::5432','postgres:16-alpine']);containers.push(dbName);
 const redisName=`streamflix-redis-test-${suffix}`;run(['run','-d','--name',redisName,'-p','127.0.0.1::6379','redis:7.4-alpine']);containers.push(redisName);
 const dbPort=run(['port',dbName,'5432/tcp']).split(':').pop();const redisPort=run(['port',redisName,'6379/tcp']).split(':').pop();
 admin=new pg.Pool({host:'127.0.0.1',port:dbPort,user:'test_admin',password,database:'postgres'});
 let ready=false;for(let i=0;i<40;i++){try{await admin.query('SELECT 1');ready=true;break;}catch{await new Promise(r=>setTimeout(r,500));}}assert(ready,'Postgres did not become ready');
 for(const [service,db] of [['auth','authdb'],['user','userdb'],['billing','billingdb']]){await admin.query(`CREATE ROLE ${service}_app LOGIN PASSWORD '${password}'`);await admin.query(`CREATE DATABASE ${db} OWNER ${service}_app`);}
 // Local Redis test fixture requires authentication just like the deployment.
 run(['exec',redisName,'redis-cli','CONFIG','SET','requirepass',password]);
 const portBase=23000+parseInt(suffix.slice(0,2),16)*10;
 const configs=[['auth-service','authdb',portBase],['user-service','userdb',portBase+1],['billing-service','billingdb',portBase+2]];
 const keys=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
 const common={...process.env,JWT_PRIVATE_KEY:keys.privateKey,JWT_PUBLIC_KEY:keys.publicKey,DB_HOST:'127.0.0.1',DB_PORT:dbPort,DB_PASSWORD:password,DB_SSL:'false',REDIS_URL:`redis://127.0.0.1:${redisPort}`,REDIS_PASSWORD:password,COOKIE_SECURE:'false',PUBLIC_ORIGIN:`http://127.0.0.1:${portBase+3}`,PAYMENT_API_KEY:randomBytes(32).toString('hex')};
 for(const [service,db,port] of configs){const env={...common,SERVICE_NAME:service,DB_NAME:db,DB_USER:service.split('-')[0]+'_app',PORT:String(port)};const migration=spawnSync(process.execPath,['app/shared/migrate.js'],{env,encoding:'utf8'});assert.equal(migration.status,0,migration.stderr);const child=spawn(process.execPath,[`app/${service}/src/index.js`],{env,stdio:'ignore'});children.push(child);}
 const routes={AUTH_URL:portBase,USER_URL:portBase+1,BILLING_URL:portBase+2,CATALOG_URL:portBase,SEARCH_URL:portBase,RECO_URL:portBase,NOTIF_URL:portBase,ACTIVITY_URL:portBase,ADMIN_URL:portBase};const env={...common,PORT:String(portBase+3)};for(const [key,port] of Object.entries(routes))env[key]=`http://127.0.0.1:${port}`;children.push(spawn(process.execPath,['app/api-gateway/src/index.js'],{env,stdio:'ignore'}));
 const base=common.PUBLIC_ORIGIN;ready=false;for(let i=0;i<60;i++){try{const response=await fetch(`${base}/ready`);if(response.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert(ready,'Gateway did not become ready');
 const call=(p,method='GET',body,cookie,key)=>fetch(`${base}/api/${p}`,{method,headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await call('users/my-list')).status,401);
 const email='viewer@example.com',viewerPassword='a long unique passphrase';assert.equal((await call('auth/register','POST',{email,password:viewerPassword})).status,201);
 assert.equal((await call('auth/login','POST',{email,password:'wrong'})).status,401);
 const login=await call('auth/login','POST',{email,password:viewerPassword});assert.equal(login.status,200);const setCookie=login.headers.get('set-cookie');assert(setCookie.includes('HttpOnly'));assert(setCookie.includes('SameSite=Strict'));const cookie=setCookie.split(';')[0];
 const userDB=new pg.Pool({...common,host:'127.0.0.1',port:dbPort,user:'auth_app',password,database:'authdb'});const {rows}=await userDB.query('SELECT password_hash FROM users WHERE email=$1',[email]);assert(rows[0].password_hash.startsWith('scrypt$'));assert(!rows[0].password_hash.includes(viewerPassword));await userDB.end();
 assert.equal((await call('users/my-list/1','PUT',null,cookie)).status,204);assert.deepEqual(await(await call('users/my-list','GET',null,cookie)).json(),[1]);
 assert.equal((await call('users/progress/1','PUT',{seconds:-1},cookie)).status,400);assert.equal((await call('users/progress/1','PUT',{seconds:42},cookie)).status,204);
 const progress=await(await call('users/progress','GET',null,cookie)).json();assert.equal(progress[0].title_id,1);assert.equal(progress[0].seconds,42);
 for(const invalid of ['0','2147483648','9007199254740993']){assert.equal((await call(`users/my-list/${invalid}`,'PUT',null,cookie)).status,400);assert.equal((await call(`users/progress/${invalid}`,'PUT',{seconds:1},cookie)).status,400);}
 const one=await(await call('billing/subscribe','POST',{plan:'basic'},cookie,'test-request-123')).json();const two=await(await call('billing/subscribe','POST',{plan:'premium'},cookie,'test-request-123')).json();assert.deepEqual(one,two);
 await call('auth/register','POST',{email:'other@example.com',password:viewerPassword});const other=await call('auth/login','POST',{email:'other@example.com',password:viewerPassword});const otherCookie=other.headers.get('set-cookie').split(';')[0];assert.deepEqual(await(await call('users/my-list','GET',null,otherCookie)).json(),[]);
 const csrf=await fetch(`${base}/api/users/my-list/2`,{method:'PUT',headers:{Cookie:cookie,Origin:'https://evil.example'}});assert.equal(csrf.status,403);
 const logout=await call('auth/logout','POST',null,cookie);assert.equal(logout.status,204);assert(logout.headers.get('set-cookie').includes('Expires='));
 console.log('PASS: real Postgres migrations and hashed passwords, authenticated gateway proxy, secure cookie forwarding, ownership isolation, persisted watchlist/progress, idempotent sandbox billing, CSRF, logout');
}finally{
 for(const child of children)child.kill('SIGTERM');if(admin)await admin.end();for(const name of containers)run(['rm','-f',name]);await rm(folder,{recursive:true,force:true});
}

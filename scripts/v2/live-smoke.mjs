// Run after deployment: STREAMFLIX_BASE_URL=https://your-host node scripts/v2/live-smoke.mjs
// Trust the learning CA using NODE_EXTRA_CA_CERTS; TLS verification stays enabled.
import assert from 'node:assert/strict';
const base=process.env.STREAMFLIX_BASE_URL;if(!base)throw new Error('STREAMFLIX_BASE_URL is required');
const email=`smoke-${Date.now()}@example.com`;const password=crypto.randomUUID()+crypto.randomUUID();let cookie;
async function api(path,method='GET',body){const response=await fetch(`${base}/api/${path}`,{method,headers:{...(cookie?{Cookie:cookie}:{}),Origin:new URL(base).origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});return response;}
assert.equal((await api('users/my-list')).status,401);
assert.equal((await api('auth/register','POST',{email,password})).status,201);
const login=await api('auth/login','POST',{email,password});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];assert(cookie.startsWith('streamflix_session='));
const titles=await(await api('catalog/titles')).json();assert(titles.length>=16);const title=titles.find(t=>t.media_url);
assert.equal((await api(`users/my-list/${title.id}`,'PUT')).status,204);assert((await(await api('users/my-list')).json()).includes(title.id));
assert.equal((await api(`users/progress/${title.id}`,'PUT',{seconds:42})).status,204);
const viewed=await api(`catalog/titles/${title.id}/view`,'POST');assert.equal(viewed.status,200);assert.equal((await viewed.json()).eventPublished,true);
let count=0;for(let attempt=0;attempt<10;attempt++){count=(await(await api(`activity/views/${encodeURIComponent(title.name)}`)).json()).views;if(count>0)break;await new Promise(r=>setTimeout(r,1000));}assert(count>0,'Kafka consumer did not update Redis');
assert.equal((await api(`search/search?q=${encodeURIComponent(title.name)}`)).status,200);
assert.equal((await api('auth/logout','POST')).status,204);cookie=null;assert.equal((await api('users/my-list')).status,401);
console.log('PASS: anonymous authorization, registration, secure session, catalog, watchlist, progress, Kafka/Redis event flow, search, logout');

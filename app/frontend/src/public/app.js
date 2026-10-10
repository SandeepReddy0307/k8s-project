'use strict';
const $=id=>document.getElementById(id);
const state={titles:[],user:null,list:new Set(),progress:[],view:'home'};
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function status(message){$('status').textContent=message;}
async function api(path,options={}){
 const response=await fetch(`/api/${path}`,{credentials:'same-origin',signal:AbortSignal.timeout(10000),...options,headers:{'Content-Type':'application/json',...options.headers}});
 const body=response.status===204?null:await response.json();
 if(!response.ok)throw new Error(body?.error||'Something went wrong. Please try again.');return body;
}
function cards(container,titles,{ranked=false,progress=false}={}){
 container.replaceChildren();if(!titles.length){const empty=document.createElement('p');empty.className='empty';empty.textContent=state.view==='list'?'Your list is waiting for its first story.':'No titles here yet.';container.append(empty);return;}
 titles.forEach((title,index)=>{
  const card=document.createElement('article');card.className='card';
  // Posters are only same-origin catalog assets; catalog text is escaped.
  const poster=/^\/assets\/poster-\d+\.(svg|jpg)$/.test(title.poster)?title.poster:'/assets/icon.svg';
  card.innerHTML=`<button class="poster-button" aria-label="Details for ${esc(title.name)}"><img src="${poster}" alt="${esc(title.name)} poster" loading="lazy" width="600" height="900"></button>${ranked&&index<3?'<span class="top-badge">TOP '+(index+1)+'</span>':''}<button class="card-add" aria-label="${state.list.has(title.id)?'Remove from':'Add to'} My List">${state.list.has(title.id)?'✓':'+'}</button><h3>${esc(title.name)}</h3><div class="card-meta"><span>${esc(title.year)}</span><span class="badge">${esc(title.rating)}</span><span>${esc(title.genre)}</span></div>`;
  card.querySelector('.poster-button').addEventListener('click',()=>detail(title));
  card.querySelector('.card-add').addEventListener('click',()=>toggleList(title));
  if(progress){const item=state.progress.find(p=>Number(p.title_id)===title.id);const bar=document.createElement('progress');bar.max=title.duration*60;bar.value=item?.seconds||0;bar.setAttribute('aria-label','Watch progress');card.append(bar);}
  container.append(card);
 });
}
function render(){
 const titles=state.titles;
 cards($('trending'),titles.slice(0,8),{ranked:true});
 cards($('adventure'),titles.filter(t=>['Sci-Fi','Adventure','Action'].includes(t.genre)));
 cards($('watchlist'),titles.filter(t=>state.list.has(t.id)));
 $('list-description').textContent=state.user?'Your next great watch, saved for later.':'Sign in to build your own collection.';
 const continued=state.progress.map(p=>titles.find(t=>t.id===Number(p.title_id))).filter(Boolean);
 $('continue-section').classList.toggle('hidden',!continued.length);cards($('continue'),continued,{progress:true});
 const genres=['All',...new Set(titles.map(t=>t.genre))];$('genres').replaceChildren();
 genres.forEach((genre,i)=>{const b=document.createElement('button');b.textContent=genre;b.classList.toggle('active',i===0);b.addEventListener('click',()=>{for(const other of $('genres').children)other.classList.remove('active');b.classList.add('active');cards($('genre-cards'),titles.filter(t=>genre==='All'||t.genre===genre));});$('genres').append(b);});
 cards($('genre-cards'),titles);$('signin').classList.toggle('hidden',!!state.user);$('logout').classList.toggle('hidden',!state.user);$('account').textContent=state.user?state.user.email[0].toUpperCase():'S';
}
async function refreshPersonal(){
 if(!state.user){state.list=new Set();state.progress=[];render();return;}
 const [list,progress]=await Promise.all([api('users/my-list'),api('users/progress')]);state.list=new Set(list.map(Number));state.progress=progress;render();
 try{const reco=await api(`recommendations/recommendations/${encodeURIComponent(state.user.email)}`);cards($('recommendations'),reco.titles);}catch{cards($('recommendations'),state.titles.slice(3,9));}
}
function openModal(html){$('modal-body').innerHTML=html;if(!$('modal').open)$('modal').showModal();}
function auth(register=false){
 openModal(`<form class="form" id="auth-form"><p class="eyebrow">WELCOME TO STREAMFLIX</p><h2>${register?'Create your account':'Your next story awaits'}</h2><label>Email<input name="email" type="email" autocomplete="email" required maxlength="254"></label><label>Password<input name="password" type="password" autocomplete="${register?'new-password':'current-password'}" required minlength="${register?12:1}" maxlength="128"></label>${register?'<p>Use at least 12 characters. A long, unique passphrase works well.</p>':''}<div class="error" id="auth-error" role="alert"></div><button class="button" type="submit">${register?'Create account':'Sign in'}</button><p>${register?'Already have an account?':'New to StreamFlix?'} <button id="switch-auth" type="button" class="text-button">${register?'Sign in':'Join now'}</button></p></form>`);
 $('switch-auth').addEventListener('click',()=>auth(!register));
 $('auth-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;const button=form.querySelector('[type=submit]');button.disabled=true;try{const data=Object.fromEntries(new FormData(form));await api(`auth/${register?'register':'login'}`,{method:'POST',body:JSON.stringify(data)});if(register){auth(false);$('auth-error').textContent='Account created. Sign in to continue.';}else{state.user=(await api('auth/me')).user;$('modal').close();await refreshPersonal();status('Welcome back. Find your next favorite.');}}catch(error){$('auth-error').textContent=error.message;}finally{button.disabled=false;}});
}
async function toggleList(title){
 if(!state.user)return auth();
 try{const exists=state.list.has(title.id);await api(`users/my-list/${title.id}`,{method:exists?'DELETE':'PUT'});exists?state.list.delete(title.id):state.list.add(title.id);render();status(`${title.name} ${exists?'removed from':'added to'} My List.`);}catch(e){status(e.message);}
}
function detail(title){
 openModal(`<div class="detail"><img src="${esc(title.poster)}" alt="${esc(title.name)} poster"><div><p class="eyebrow">${esc(title.genre)}</p><h2>${esc(title.name)}</h2><p>${esc(title.year)} · ${esc(title.rating)} · ${esc(title.duration)} min</p><p>${esc(title.description)}</p><button id="detail-play" class="button light">▶ ${title.media_url?'Play film':'Preview collection'}</button><button id="detail-list" class="button glass">${state.list.has(title.id)?'✓ In My List':'+ My List'}</button>${!title.media_url?'<p>This is an original concept title. Full open movies are available in the Animation collection.</p>':''}</div></div>`);
 $('detail-play').addEventListener('click',()=>play(title));$('detail-list').addEventListener('click',()=>toggleList(title));
}
let currentTitle=null,lastSaved=0;
async function play(title){
 if(!state.user)return auth();
 if(!title.media_url){const available=state.titles.find(t=>t.media_url);if(available){detail(available);status('Enjoy one of our licensed open films.');}return;}
 const url=new URL(title.media_url);if(url.protocol!=='https:'||url.hostname!=='storage.googleapis.com')return status('This film is currently unavailable.');
 $('modal').close();currentTitle=title;lastSaved=0;$('player-title').textContent=title.name;$('player-note').textContent='Open movie by the Blender Foundation. Full credits are preserved in the film.';$('video').src=url.href;$('player').showModal();
 $('video').addEventListener('loadedmetadata',()=>{const prior=state.progress.find(p=>Number(p.title_id)===title.id);if(prior&&prior.seconds<$('video').duration-15)$('video').currentTime=prior.seconds;},{once:true});
 try{await api(`catalog/titles/${title.id}/view`,{method:'POST'});}catch{status('Playback is available; view tracking is temporarily unavailable.');}
 $('video').play().catch(()=>{});
}
async function saveProgress(){if(!currentTitle||!state.user)return;try{await api(`users/progress/${currentTitle.id}`,{method:'PUT',body:JSON.stringify({seconds:$('video').currentTime})});}catch{/* Keep playback independent of progress storage. */}}
$('video').addEventListener('timeupdate',()=>{if(Date.now()-lastSaved>15000){lastSaved=Date.now();saveProgress();}});
$('video').addEventListener('error',()=>{$('player-note').textContent='The film could not load. Check your connection or try again later.';});
$('close-player').addEventListener('click',()=>{$('player').close();});$('player').addEventListener('close',async()=>{$('video').pause();await saveProgress();$('video').removeAttribute('src');$('video').load();currentTitle=null;try{await refreshPersonal();}catch{}});
$('close-modal').addEventListener('click',()=>{$('modal').close();});$('signin').addEventListener('click',()=>auth());
$('account').addEventListener('click',async()=>{if(!state.user)return auth();try{const profile=await api('users/profile');openModal(`<form class="form" id="profile-form"><h2>Your profile</h2><p>${esc(state.user.email)}</p><label>Display name<input name="display_name" value="${esc(profile.display_name)}" required maxlength="64"></label><button class="button">Save profile</button><p id="profile-status" role="status"></p></form>`);$('profile-form').addEventListener('submit',async e=>{e.preventDefault();try{await api('users/profile',{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});$('profile-status').textContent='Profile saved.';}catch(error){$('profile-status').textContent=error.message;}});}catch(e){status(e.message);}});
$('logout').addEventListener('click',async()=>{try{await api('auth/logout',{method:'POST'});state.user=null;await refreshPersonal();status('You have signed out.');}catch(e){status(e.message);}});
$('hero-info').addEventListener('click',()=>{const title=state.titles.find(t=>t.id===2);if(title)detail(title);});$('hero-play').addEventListener('click',()=>{const title=state.titles.find(t=>t.media_url);if(title)play(title);});
$('plans-button').addEventListener('click',()=>{openModal('<p class="eyebrow">YOUR FRONT-ROW SEAT</p><h2>Choose your experience</h2><p>Sandbox plans. No card details or real charges.</p><div class="plan-grid">'+[['basic','7.99','HD · One screen'],['standard','12.99','Full HD · Two screens'],['premium','17.99','4K · Four screens']].map(([plan,price,label])=>`<div class="plan"><h3>${plan[0].toUpperCase()+plan.slice(1)}</h3><p>$${price} / month</p><p>${label}</p><button class="button" data-plan="${plan}">Choose plan</button></div>`).join('')+'</div><p id="plan-status" role="status"></p>');for(const button of document.querySelectorAll('[data-plan]'))button.addEventListener('click',async()=>{if(!state.user)return auth();button.disabled=true;try{await api('billing/subscribe',{method:'POST',headers:{'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({plan:button.dataset.plan})});$('plan-status').textContent='Sandbox subscription activated.';}catch(e){$('plan-status').textContent=e.message;}finally{button.disabled=false;}});});
$('about-button').addEventListener('click',()=>openModal('<h2>A world of open stories</h2><p>StreamFlix is an independent streaming engineering project with original visual design and concept artwork.</p><p>Big Buck Bunny © 2008 Blender Foundation, <a href="https://peach.blender.org/about/" target="_blank" rel="noopener">CC BY 3.0</a>. Sintel © 2010 Blender Foundation, <a href="https://durian.blender.org/sharing/" target="_blank" rel="noopener">CC BY 3.0</a>. Tears of Steel © 2012 Blender Foundation, <a href="https://mango.blender.org/sharing/" target="_blank" rel="noopener">CC BY 3.0</a>. Movie files are served from Google’s public sample bucket; credits are retained.</p><p>Other catalog entries are fictional concepts without full films. Subscription plans are a sandbox.</p>'));
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{state.view=button.dataset.view;for(const b of document.querySelectorAll('[data-view]'))b.classList.toggle('active',b===button);$('results').classList.toggle('hidden',state.view==='home');$('shelves').classList.toggle('hidden',state.view!=='home');if(state.view!=='home'){$('results-title').textContent=state.view==='list'?'My List':state.view==='movies'?'Movies':'Discover something new';cards($('results-cards'),state.view==='list'?state.titles.filter(t=>state.list.has(t.id)):state.view==='movies'?state.titles.filter(t=>t.media_url):state.titles);}});
let searchTimer,searchVersion=0;
$('search').addEventListener('input',()=>{clearTimeout(searchTimer);const version=++searchVersion;const q=$('search').value.trim();if(!q){$('results').classList.add('hidden');$('shelves').classList.remove('hidden');return;}searchTimer=setTimeout(async()=>{try{const results=await api(`search/search?q=${encodeURIComponent(q)}`);if(version!==searchVersion)return;$('results').classList.remove('hidden');$('shelves').classList.add('hidden');$('results-title').textContent=`Results for “${q}”`;cards($('results-cards'),results);}catch(e){status(e.message);}},300);});
(async()=>{for(let i=0;i<6;i++){const skeleton=document.createElement('div');skeleton.className='loading-card';$('trending').append(skeleton);}try{state.titles=await api('catalog/titles');try{state.user=(await api('auth/me')).user;}catch{state.user=null;}render();cards($('recommendations'),state.titles.slice(3,9));await refreshPersonal();}catch{status('We couldn’t load your collection. Please refresh to try again.');$('trending').replaceChildren();}})();

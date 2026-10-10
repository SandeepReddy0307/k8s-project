const {test,expect}=require('@playwright/test');const titles=require('../../app/shared/catalog.json');
test.beforeEach(async({page})=>{
 let authenticated=false,list=[],progress=[];
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname,method=route.request().method();let body={},status=200;
  if(path==='/api/catalog/titles')body=titles;
  else if(path==='/api/auth/me'){body=authenticated?{user:{email:'viewer@example.com'}}:{error:'authentication-required'};if(!authenticated)status=401;}
  else if(path==='/api/auth/login'){authenticated=true;body={user:{email:'viewer@example.com'}};}
  else if(path==='/api/auth/register')body={message:'registered'};
  else if(path==='/api/auth/logout'){authenticated=false;status=204;}
  else if(path==='/api/users/my-list')body=list;
  else if(path.startsWith('/api/users/my-list/')){const id=Number(path.split('/').pop());list=method==='PUT'?[...list,id]:list.filter(n=>n!==id);status=204;}
  else if(path==='/api/users/progress')body=progress;
  else if(path==='/api/users/profile')body={email:'viewer@example.com',display_name:'Viewer'};
  else if(path.startsWith('/api/recommendations/'))body={titles:titles.slice(0,6)};
  else if(path==='/api/search/search')body=titles.filter(t=>t.name.toLowerCase().includes(url.searchParams.get('q').toLowerCase()));
  else if(path==='/api/billing/subscribe')body={status:'active',mode:'sandbox'};
  else body={eventPublished:true};
  await route.fulfill({status,contentType:'application/json',body:status===204?'':JSON.stringify(body)});
 });
});
test('catalog renders original artwork, responsive navigation and accessible details',async({page},testInfo)=>{const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.locator('#trending .card')).toHaveCount(8);await expect(page.getByRole('heading',{name:'Trending now'})).toBeVisible();await page.getByRole('button',{name:'More info'}).click();await expect(page.locator('#modal')).toBeVisible();await expect(page.locator('#modal-body h2')).toHaveText('Neon Horizon');await page.getByRole('button',{name:'Close dialog'}).click();await expect(page.locator('#modal')).not.toBeVisible();expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:`docs/v2/interface-${testInfo.project.name}.png`,fullPage:true});});
test('sign-in enables watchlist and sandbox subscription',async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByLabel('Email', {exact:true}).fill('viewer@example.com');await page.getByLabel('Password', {exact:true}).fill('a long unique passphrase');await page.locator('#auth-form').getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();await page.locator('#trending .card-add').first().click();await expect(page.locator('#watchlist .card')).toHaveCount(1);await page.getByRole('button',{name:'Explore plans'}).click();await page.locator('[data-plan=basic]').click();await expect(page.locator('#plan-status')).toHaveText('Sandbox subscription activated.');});
test('search works and unavailable upstream is shown clearly',async({page})=>{await page.goto('/');await page.getByRole('searchbox').fill('Sintel');await expect(page.locator('#results .card')).toHaveCount(1);await expect(page.locator('#results h3')).toHaveText('Sintel');await page.route('**/api/search/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"search-unavailable"}'}));await page.getByRole('searchbox').fill('different');await expect(page.locator('#status')).toHaveText('search-unavailable');});

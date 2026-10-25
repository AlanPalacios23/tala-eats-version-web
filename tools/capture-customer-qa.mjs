import { chromium } from 'playwright';
import fs from 'node:fs';
const ORIGIN='http://127.0.0.1:4173';
const widths=[320,360,390,430,768,1024];
fs.mkdirSync('artifacts/customer-visual',{recursive:true});
const browser=await chromium.launch({headless:true});
const merchant={id:11,name:'Antojitos La Terraza',market_code:'TALA-JAL',cuisine:'Comida mexicana',description:'Sabores locales',emoji:'🌮',eta_min:25,is_open:true,pickup_enabled:true,cover_image_url:'https://static.example.test/invalid-cover.jpg',
 menu_items:[{id:21,restaurant_id:11,name:'Tacos de birria',category:'Tacos',description:'Con cebolla y cilantro',price:'45.00',stock:30,is_available:true,image_url:'https://static.example.test/missing-product.jpg'},{id:22,restaurant_id:11,name:'Quesabirria',category:'Tacos',description:'Tortilla dorada',price:'65.00',stock:12,is_available:true,image_url:null}]};
const order={id:51,restaurant_id:11,status:'preparing',order_type:'pickup',payment_method:'cash',payment_status:'pending',total:'103.15',created_at:new Date().toISOString(),items:[{name_snapshot:'Tacos de birria',unit_price:'45.00',quantity:2}]};
const user={id:42,name:'Cliente de prueba',email:'qa@example.test',role:'customer'};
const fulfill=async(route)=>{
 const req=route.request();const url=new URL(req.url()),path=url.pathname,method=req.method();
 const data=()=>{
  if(path==='/api/v1/auth/me')return user;
  if(path==='/api/v1/restaurants')return [merchant];
  if(path==='/api/v1/restaurants/11')return merchant;
  if(path==='/api/v1/platform/favorites')return [];
  if(path==='/api/v1/platform/addresses')return [{id:33,label:'Casa',address:'Centro, Tala, Jalisco',lat:20.652,lng:-103.703,is_default:true}];
  if(path==='/api/v1/v11/privacy/preferences')return {marketing_opt_in:true,analytics_opt_in:false,personalization_opt_in:true};
  if(path==='/api/v1/orders/payment-methods')return {methods:[{id:'cash',enabled:true},{id:'stripe',enabled:false}],pickup_checkout_supported:true,pickup_quote_supported:true,delivery_checkout_supported:false,delivery_cash_supported:false,delivery_quote_supported:false};
  if(path==='/api/v1/payments/stripe/config')return {enabled:false,publishable_key:null};
  if(path==='/api/v1/orders/quote'){const body=req.postDataJSON();return {restaurant_id:body.restaurant_id,order_type:body.order_type,payment_method:body.payment_method,currency:'MXN',inventory_reserved:false,quote_is_binding:false,total:'103.15',subtotal:'90.00',service_fee:'13.15',delivery_fee:'0.00',tip:'0.00'};}
  if(path==='/api/v1/orders/mine')return [order];
  if(path==='/api/v1/v11/orders/51/live')return {order};
  if(path==='/api/v1/platform/wallet')return {balance:'0.00',points:0,plus_member:false,transactions:[]};
  if(path==='/api/v1/platform/notifications')return [];
  if(path==='/api/v1/platform/support')return [];
  if(path==='/api/v1/platform/orders/51/chat')return [];
  return null;
 };
 const content=data();
 if(content===null){await route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({detail:'Endpoint no simulado en QA'})});return;}
 if(method!=='GET'&&path!=='/api/v1/orders/quote'){await route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({detail:'Writes blocked in visual QA'})});return;}
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(content)});
};
for(const width of widths){
 const context=await browser.newContext({viewport:{width,height:870},deviceScaleFactor:1,reducedMotion:'reduce'});
 await context.route('**/api/v1/**',fulfill);
 await context.route('https://static.example.test/**',route=>route.fulfill({status:404,contentType:'text/plain',body:'Image missing intentionally'}));
 const page=await context.newPage();
 page.on('pageerror',error=>{console.error('PAGE:',error.message);process.exitCode=1;});
 async function capture(name,path,action){
  await page.goto(ORIGIN+path,{waitUntil:'networkidle'});
  await page.locator('[data-mobile-screen="launch"]').waitFor({state:'hidden',timeout:15000});
  // A screenshot of ONLY the splash is not a valid screen screenshot.
  if(await page.locator('h1').count()===0)throw new Error('Real screen missing after launch: '+path);
  if(action)await action(page);
  await page.screenshot({path:`artifacts/customer-visual/${width}-${name}.png`,fullPage:true});
 }
 await capture('home','/clientes',async p=>{
  const photo=p.locator('.mobile-merchant-photo .customer-image-fallback');
  await photo.waitFor({state:'visible',timeout:12000});
  if(await p.locator('.mobile-merchant-photo img').count())throw new Error('Failed merchant image was not replaced by fallback');
 });
 await capture('search','/buscar',async p=>{await p.getByRole('searchbox').fill('birria');await p.getByText('Tacos de birria',{exact:true}).waitFor({state:'visible',timeout:12000});});
 await capture('restaurant','/comercio/11',async p=>{
  await p.locator('.mobile-commerce-hero .customer-image-fallback').waitFor({state:'visible',timeout:12000});
  await p.locator('.mobile-dish-photo .customer-image-fallback').first().waitFor({state:'visible',timeout:12000});
 });
 await capture('account','/cuenta');
 await capture('orders','/pedidos');
 await capture('profile','/editar-perfil');
 await context.close();
}
// Regression: actual production URLs still mention staging, although the
// immutable catalog files exist on the LIVE same-origin API proxy. The browser
// must request ONLY same-origin images, never staging/Cloudflare Access.
{
 const STAGE='https://api-stage-talaeats.alan-palacios-dev.com';
 const PREFIX='/api/v1/uploads/catalog/';
 const cover='r1-4YiKcP7oVyQdLwDAWJP8y3yiE1O-wA6h.jpg';
 const menu='r1-p1-fp-ow0ULDj24aM6vkfKWfZAwElFJyXDq.jpg';
 const version={...merchant,
  cover_image_url:STAGE+PREFIX+cover,
  menu_items:[{...merchant.menu_items[0],image_url:STAGE+PREFIX+menu}]};
 // Tiny PNG fixture (never an external or real account image).
 const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aW0cAAAAASUVORK5CYII=','base64');
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 let stageRequested=false,liveImageRequests=0;
 await context.route(STAGE+'/**',async route=>{stageRequested=true;await route.abort();});
 await context.route('**/api/v1/**',async route=>{
  const pathname=new URL(route.request().url()).pathname;
  if(pathname===PREFIX+cover||pathname===PREFIX+menu){
   liveImageRequests++;
   await route.fulfill({status:200,contentType:'image/png',body:image});return;
  }
  if(pathname==='/api/v1/restaurants'){await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([version])});return;}
  if(pathname==='/api/v1/restaurants/11'){await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(version)});return;}
  await fulfill(route);
 });
 const page=await context.newPage();
 page.on('pageerror',err=>{throw err;});
 for(const [path,selector] of [
  ['/clientes','.mobile-merchant-photo img'],
  ['/comercio/11','.mobile-commerce-hero img'],
  ['/comercio/11','.mobile-dish-photo img']
 ]){
  if(page.url()!==ORIGIN+path)await page.goto(ORIGIN+path,{waitUntil:'networkidle'});
  const pic=page.locator(selector).first();
  await pic.waitFor({state:'visible',timeout:12000});
  const info=await pic.evaluate(img=>({src:img.getAttribute('src'),ok:img.complete&&img.naturalWidth>0}));
  if(!info.ok||!info.src?.startsWith(PREFIX))throw Error('Original catalog media failed LIVE resolution: '+path+' '+selector+' '+JSON.stringify(info));
 }
 if(stageRequested||liveImageRequests<2)throw Error('Unexpected staged image traffic or missing same-origin LIVE image request');
 await context.close();
 console.log('Original LIVE catalog media remap: 200 image from same-origin API, staging not requested.');
}
// Simulated login -> verified /auth/me -> customer home; no real credentials.
const authContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
let authenticated=false;
let loginPostCount=0;
let meAfterLogin=0;
await authContext.route('**/api/v1/**',async route=>{
 const req=route.request(),u=new URL(req.url());
 const name=u.pathname;
 if(name==='/api/v1/auth/login'&&req.method()==='POST'){
  authenticated=true;loginPostCount++;
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user,access_token:'synthetic_not_a_real_token'})});return;
 }
 if(name==='/api/v1/auth/logout'&&req.method()==='POST'){
  authenticated=false;
  await route.fulfill({status:204,body:''});return;
 }
 if(name==='/api/v1/auth/me'){
  if(authenticated){meAfterLogin++;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(user)});}
  else await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({detail:'Sin sesión de QA'})});
  return;
 }
 if(name==='/api/v1/restaurants'){
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([merchant])});return;
 }
 if(name==='/api/v1/platform/addresses'||name==='/api/v1/platform/favorites'){
  await route.fulfill({status:200,contentType:'application/json',body:'[]'});return;
 }
 await route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({detail:'Read-only synthetic QA'})});
});
await authContext.route('https://static.example.test/**',route=>route.fulfill({status:404,body:'not found'}));
const authPage=await authContext.newPage();
authPage.on('pageerror',error=>{console.error('AUTH_PAGE:',error.message);process.exitCode=1;});
await authPage.goto(ORIGIN+'/',{waitUntil:'networkidle'});
await authPage.getByRole('link',{name:/Pedir comida/}).click();
await authPage.waitForURL(ORIGIN+'/iniciar',{timeout:8000});
await authPage.locator('[data-mobile-screen="splash"]').waitFor({state:'visible'});
await authPage.locator('[data-mobile-screen="welcome"]').waitFor({state:'visible',timeout:12000});
await authPage.locator('img[src="/branding/tala-script-gradient.svg"]').first().waitFor({state:'visible'});
await authPage.screenshot({path:'artifacts/customer-visual/390-premium-welcome.png'});
await authPage.getByRole('button',{name:'Continuar',exact:true}).click();
await authPage.locator('[data-mobile-screen="methods"]').waitFor({state:'visible'});
await authPage.screenshot({path:'artifacts/customer-visual/390-premium-methods.png'});
await authPage.getByRole('link',{name:/Continuar con tu correo/}).click();
await authPage.waitForURL(ORIGIN+'/acceso');
await authPage.getByLabel('Correo electrónico').fill('qa@example.test');
await authPage.getByRole('button',{name:'Continuar'}).click();
if(await authPage.getByText(/Código 2FA|Código de 6 dígitos/i).count())throw new Error('Customer sign-in must never render optional 2FA');
await authPage.getByLabel('Contraseña',{exact:true}).fill('synthetic_password_not_used');
await authPage.getByRole('button',{name:'Iniciar sesión'}).click();
await authPage.waitForURL(ORIGIN+'/clientes',{timeout:12000});
await authPage.getByText('Hola, Cliente',{exact:false}).first().waitFor({state:'visible',timeout:10000});
// A customer's photo is local only. Verify device-local saving is shown on
// both Edit Profile and Account, without any remote photo POST.
await authPage.goto(ORIGIN+'/editar-perfil',{waitUntil:'networkidle'});
await authPage.locator('input[type="file"]').setInputFiles({name:'my-avatar.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aW0cAAAAASUVORK5CYII=','base64')});
await authPage.getByText('Foto guardada en este dispositivo.').waitFor({state:'visible',timeout:12000});
await authPage.goto(ORIGIN+'/cuenta',{waitUntil:'networkidle'});
await authPage.locator('.mobile-account-avatar img').waitFor({state:'visible',timeout:12000});
for(const [label,url] of [
 ['Términos y condiciones','https://talaeats.alan-palacios-dev.com/terminos'],
 ['Aviso de privacidad','https://talaeats.alan-palacios-dev.com/privacidad'],
 ['Eliminar mi cuenta','https://talaeats.alan-palacios-dev.com/eliminar-cuenta']
]){
 const link=authPage.getByRole('link',{name:new RegExp(label,'i')});
 if(await link.getAttribute('href')!==url||await link.getAttribute('target')!=='_blank')
  throw new Error('Legal action must open official external Cloudflare link: '+label);
}

if(loginPostCount!==1||meAfterLogin<1)throw new Error('Login did not verify server session after authentication');
// Flutter sign-out must exit the authenticated shell and show login.
await authPage.goto(ORIGIN+'/cuenta',{waitUntil:'networkidle'});
authPage.on('dialog',dialog=>dialog.accept());
await authPage.getByRole('button',{name:'Cerrar sesión'}).click();
await authPage.waitForURL(ORIGIN+'/acceso',{timeout:12000});
await authPage.getByLabel('Correo electrónico').waitFor({state:'visible',timeout:10000});
await authContext.close();
await browser.close();
console.log('QA screenshots:',widths.join(', '),'px; real screen after splash + simulated auth and 404 image recovery PASS. No production writes.');

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
await authPage.getByRole('button',{name:'Continuar',exact:true}).click();
await authPage.locator('[data-mobile-screen="methods"]').waitFor({state:'visible'});
await authPage.getByRole('link',{name:/Continuar con tu correo/}).click();
await authPage.waitForURL(ORIGIN+'/acceso');
await authPage.getByLabel('Correo electrónico').fill('qa@example.test');
await authPage.getByRole('button',{name:'Continuar'}).click();
await authPage.getByLabel('Contraseña').fill('synthetic_password_not_used');
await authPage.getByRole('button',{name:'Iniciar sesión'}).click();
await authPage.waitForURL(ORIGIN+'/clientes',{timeout:12000});
await authPage.getByText('Hola, Cliente',{exact:false}).first().waitFor({state:'visible',timeout:10000});
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

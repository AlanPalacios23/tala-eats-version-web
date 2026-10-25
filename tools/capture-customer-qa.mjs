import { chromium } from 'playwright';
import fs from 'node:fs';
const ORIGIN='http://127.0.0.1:4173';
const widths=[320,360,390,430,768,1024];
fs.mkdirSync('artifacts/customer-visual',{recursive:true});
const browser=await chromium.launch({headless:true});
const merchant={id:11,name:'Antojitos La Terraza',market_code:'TALA-JAL',cuisine:'Comida mexicana',description:'Sabores locales',emoji:'🌮',eta_min:25,is_open:true,pickup_enabled:true,cover_image_url:null,
 menu_items:[{id:21,restaurant_id:11,name:'Tacos de birria',category:'Tacos',description:'Con cebolla y cilantro',price:'45.00',stock:30,is_available:true,image_url:null},{id:22,restaurant_id:11,name:'Quesabirria',category:'Tacos',description:'Tortilla dorada',price:'65.00',stock:12,is_available:true,image_url:null}]};
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
 const page=await context.newPage();
 page.on('pageerror',error=>{console.error('PAGE:',error.message);process.exitCode=1;});
 async function capture(name,path,action){
  await page.goto(ORIGIN+path,{waitUntil:'networkidle'});
  if(action)await action(page);
  await page.screenshot({path:`artifacts/customer-visual/${width}-${name}.png`,fullPage:true});
 }
 await capture('home','/clientes');
 await capture('search','/buscar',async p=>{await p.getByRole('searchbox').fill('birria');await p.getByText('Tacos de birria',{exact:true}).waitFor({state:'visible',timeout:12000});});
 await capture('restaurant','/comercio/11');
 await capture('account','/cuenta');
 await capture('orders','/pedidos');
 await capture('profile','/editar-perfil');
 await context.close();
}
await browser.close();
console.log('QA screenshots:',widths.join(', '),'px; synthetic backend only, never production data.');

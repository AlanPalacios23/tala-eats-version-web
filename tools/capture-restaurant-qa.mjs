import {chromium} from 'playwright';
import fs from 'node:fs';

const BASE=process.env.RESTAURANT_QA_ORIGIN||'http://127.0.0.1:4173';
const widths=[320,360,390,430,768,1280];
const dir=process.env.RESTAURANT_QA_DIR||'artifacts/restaurant-visual';
fs.mkdirSync(dir,{recursive:true});
const shop={
 id:11,name:'Antojitos La Terraza',description:'Sabores de nuestra región',cuisine:'Comida mexicana',
 address:'Centro, Tala, Jalisco',market_code:'TALA-JAL',eta_min:30,is_open:true,
 verification_status:'verified',pickup_enabled:true,lat:20.652,lng:-103.703,
 menu_items:[
  {id:21,restaurant_id:11,name:'Tacos de birria',category:'Tacos',description:'Con cebolla y cilantro',price:'45.00',stock:30,is_available:true,allergens:'',is_combo:false},
  {id:22,restaurant_id:11,name:'Quesabirria',category:'Tacos',description:'Tortilla dorada, queso y consomé',price:'65.00',stock:7,is_available:true,allergens:'lácteos',is_combo:false},
  {id:23,restaurant_id:11,name:'Agua fresca',category:'Bebidas',description:'Horchata natural',price:'35.00',stock:0,is_available:false,allergens:'',is_combo:false},
  {id:24,restaurant_id:11,name:'Combo familiar',category:'Combos',description:'Cuatro órdenes y bebidas',price:'289.00',stock:12,is_available:true,allergens:'',is_combo:true},
 ]
};
const time=new Date().toISOString();
const order=(id,status,payment_method='cash',payment_status='pending',order_type='pickup')=>({
 id,restaurant_id:11,status,order_type,payment_method,payment_status,created_at:time,
 total:'120.00',subtotal:'100.00',items:[{name_snapshot:'Tacos de birria',quantity:2,unit_price:'45.00'}]
});
const orders=[
 order(8101,'received','cash','pending'),
 order(8102,'confirmed','stripe','paid'),
 order(8103,'preparing','cash','pending'),
 order(8104,'ready','stripe','paid'),
 order(8105,'ready','stripe','paid','delivery'),
 order(8106,'received','stripe','pending'),
 order(8099,'delivered','stripe','paid'),
];
const owner={id:12,name:'Comerciante QA',email:'merchant@example.test',role:'restaurant'};
const accountByRole={
 restaurant:owner,
 customer:{id:23,name:'Comerciante aspirante QA',email:'aspirante@example.test',role:'customer'},
 admin:{id:2,name:'Administrador QA',email:'admin@example.test',role:'admin'}
};
const connect={owner_approved:true,transfers_active:true,payouts_enabled:true,details_submitted:true,ready:true};
const finance={restaurant_id:11,commercial_plan:'FAIR',commission_rate:'0.1500',gross_food_sales:'100.00',commission:'15.00',net_payable:'85.00',orders:1,payouts:[]};
const data=new Map([
 ['/api/v1/auth/me',owner],
 ['/api/v1/owner/restaurant',shop],
 ['/api/v1/onboarding/mine',[]],
 ['/api/v1/admin/onboarding',[{id:41,user_id:23,entity_type:'restaurant',business_name:'Antojitos La Terraza',status:'pending',tax_id:'',created_at:time,updated_at:time,notes:''}]],
 ['/api/v1/owner/orders',orders],
 ['/api/v1/owner/analytics',{orders:5,delivered:1,gross_sales:100,inventory_low:1}],
 ['/api/v1/owner/finance',finance],
 ['/api/v1/owner/finance/earnings/11',{
  restaurant_id:11,currency:'MXN',unit:'centavos',
  earnings_by_status:[{state:'held',total_minor:'8500',orders:'2'},{state:'reserved',total_minor:'2500',orders:'1'}],
  physical_cash_due_to_platform:[],transfer_not_executed:true
 }],
 ['/api/v1/owner/finance/connect/11/status',connect],
 ['/api/v1/owner/employees',[
  {id:1,user_id:22,name:'Miembro de caja',email:'caja@example.test',role:'cashier'}
 ]]
]);
const browser=await chromium.launch({headless:true});
let writeRequests=0;
const routeApi=async(route,role='restaurant')=>{
 const req=route.request(),path=new URL(req.url()).pathname,method=req.method();
 if(method!=='GET'){
  writeRequests++;
  await route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({detail:'QA visual — escrituras bloqueadas'})});
  return;
 }
 const content=path==='/api/v1/auth/me'?(role==='guest'?null:accountByRole[role]):data.get(path);
 await route.fulfill({status:content===undefined||content===null?401:200,
  contentType:'application/json',
  body:JSON.stringify(content===undefined||content===null?{detail:'Sin sesión de prueba'}:content)});
};
async function checkViewport(page,width,label){
 const measured=await page.evaluate(()=>({
  windowWidth:window.innerWidth,
  documentWidth:document.documentElement.scrollWidth,
  bodyWidth:document.body.scrollWidth
 }));
 if(Math.max(measured.documentWidth,measured.bodyWidth)>measured.windowWidth+2){
  const offenders=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>{
   const rect=e.getBoundingClientRect();return rect.width&&rect.right>window.innerWidth+1
  }).slice(0,16).map(e=>({tag:e.tagName,cls:typeof e.className==='string'?e.className.slice(0,80):'',text:(e.textContent??'').trim().slice(0,45),right:Math.round(e.getBoundingClientRect().right*10)/10})));
  throw new Error('Desbordamiento horizontal '+label+' '+width+': '+JSON.stringify({...measured,offenders}));
 }
}
async function openTab(page,width,label){
 const isMobile=width<=850;
 if(isMobile){
  const nav=page.locator('.rp-mobile-tabs');
  if(label==='finanzas'||label==='activacion'){
   await nav.getByRole('button',{name:'Más',exact:true}).click();
   if(label==='finanzas')await page.getByRole('button',{name:/Abrir Wallet/}).click();
   else await page.getByRole('button',{name:/Ver activación/}).click();
  }else{
   const name={pedidos:'Pedidos',cocina:'Cocina',menu:'Menú',mas:'Más',inicio:'Inicio'}[label];
   await nav.getByRole('button',{name,exact:true}).click();
  }
 }else{
  const name={pedidos:'Pedidos',cocina:'Cocina',menu:'Menú',mas:'Más',inicio:'Inicio',finanzas:'Finanzas',activacion:'Activación'}[label];
  await page.locator('.rp-nav').getByRole('button',{name,exact:false}).click();
 }
}
for(const width of widths){
 const ctx=await browser.newContext({viewport:{width,height:870},deviceScaleFactor:1,reducedMotion:'reduce'});
 await ctx.route('**/api/v1/**',route=>routeApi(route,'restaurant'));
 const page=await ctx.newPage();
 page.on('pageerror',err=>{console.error('MERCANTE PAGE ERROR:',err.message);process.exitCode=1;});
 await page.goto(BASE+'/restaurante',{waitUntil:'networkidle'});
 await page.locator('[data-restaurant-app="true"]').waitFor();
 await page.getByRole('heading',{name:'Así va tu restaurante'}).waitFor({timeout:12000});
 if(BASE.endsWith('4174')){
  await page.locator('[data-merchant-standalone="true"]').waitFor();
  const foreign=await page.evaluate(()=>[...document.querySelectorAll('script[src]')].some(node=>node.getAttribute('src')?.includes('main.tsx')));
  if(foreign)throw Error('Customer app entry leaked into restaurant origin');
 }
 const manifest=await page.locator('link[rel="manifest"]').getAttribute('href');
 if(manifest!=='/manifest-restaurante.webmanifest')throw Error('Merchant installed identity mismatched: '+manifest);
 const scenes=[
  ['inicio',null],
  ['pedidos','Pedidos'],
  ['cocina','Comandas en preparación'],
  ['menu','Mi menú'],
  ['mas','Más y ajustes'],
  ['finanzas','Wallet'],
  ['activacion','Activación del restaurante']
 ];
 for(const [name,title] of scenes){
  if(name!=='inicio')await openTab(page,width,name);
  if(title)await page.getByRole('heading',{name:title,exact:true}).waitFor({timeout:12000});
  await checkViewport(page,width,name);
  await page.screenshot({path:`${dir}/${width}-${name}.png`,fullPage:true});
  if(name==='finanzas'){
   await page.locator('[data-merchant-wallet="true"]').waitFor();
   await page.getByText('Ganancias registradas',{exact:true}).waitFor();
   await page.getByRole('button',{name:/Retirar ganancias/}).click();
   const dialog=page.getByRole('dialog',{name:'Retirar ganancias'});
   await dialog.waitFor();
   await dialog.getByText('Los retiros bancarios aún no están habilitados').waitFor();
   if(await dialog.getByText('Transferencia bancaria').count()!==1)
    throw Error('Wallet withdrawal disclaimer missing at '+width);
   await dialog.getByRole('button',{name:'Entendido'}).click();
   if(await dialog.count())throw Error('Wallet withdrawal modal did not close');
  }
  if(name==='pedidos'){
   const group=page.locator('.rp-order-filters').first();
   await group.getByRole('button',{name:'Historial',exact:true}).click();
   if(await page.locator('.rp-lane-grid').count()!==0||await page.locator('.rp-history').count()!==1)
    throw new Error('Historial must hide active lanes at '+width);
   await group.getByRole('button',{name:'Nuevos',exact:true}).click();
   if(await page.locator('.rp-history').count()!==0)
    throw new Error('New-order filter must not show historical records at '+width);
   await group.getByRole('button',{name:'Todos',exact:true}).click();
  }
  if(name==='cocina'){
   const types=page.locator('.rm-kitchen-filter-pills');
   await types.getByRole('button',{name:/A domicilio/}).click();
   if(await page.locator('.rm-ticket').count()!==1)
    throw new Error('Delivery kitchen filter did not limit tickets at '+width);
   await page.getByText('Esperando reparto autorizado. No confirmar la entrega desde cocina.').waitFor();
   if(await page.getByRole('button',{name:/Confirmar recogida con PIN/}).count()>0)
    throw new Error('Driver dispatch was confused with customer pickup');
   await types.getByRole('button',{name:/Recoger en tienda/}).click();
   if(await page.locator('.rm-ticket-warning').count()!==1)
    throw new Error('Unpaid Stripe order needs a visible kitchen warning');
   await types.getByRole('button',{name:/Todas/}).click();
  }
 }
 // Search is a real client-side control: the filtered product view must
 // reflect the requested item, not simply show an inert text field.
 await openTab(page,width,'menu');
 await page.getByRole('textbox',{name:'Buscar productos'}).fill('Quesabirria');
 await page.waitForFunction(()=>document.querySelectorAll('.rp-menu-item').length===1,{},{timeout:12000});
 await page.locator('.rp-catalog-item').filter({hasText:'Quesabirria'}).waitFor({timeout:12000});
 if(await page.locator('.rp-catalog-item').count()!==1)throw Error('Category/search functionality failed at '+width);
 if(await page.locator('.rp-catalog-editor').count())throw Error('Menu editors must be collapsed until requested');
 await page.getByRole('button',{name:'Editar',exact:true}).click();
 await page.locator('#rp-product-editor-22').waitFor({timeout:12000});
 if(width===390)await page.screenshot({path:`${dir}/390-producto-editor.png`,fullPage:true});
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 if(await page.locator('.rp-catalog-editor').count())throw Error('Cancel did not close the product editor');
 await ctx.close();
}
{
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await ctx.route('**/api/v1/**',route=>routeApi(route,'guest'));
 const page=await ctx.newPage();
 page.on('pageerror',e=>{console.error('GUEST PAGE ERROR:',e.message);process.exitCode=1;});
 await page.goto(BASE+'/restaurante',{waitUntil:'networkidle'});
 await page.locator('[data-restaurant-welcome="true"]').waitFor({timeout:12000});
 if(await page.locator('[data-mobile-screen="splash"]').count())throw Error('Merchant welcome leaked customer splash');
 await checkViewport(page,390,'bienvenida');
 await page.screenshot({path:`${dir}/390-bienvenida.png`,fullPage:true});
 await page.goto(BASE+'/restaurante/acceso',{waitUntil:'networkidle'});
 await page.locator('.rp-auth-page').waitFor({timeout:12000});
 if(await page.locator('[data-mobile-screen="splash"]').count())throw Error('Merchant login leaked customer splash');
 await checkViewport(page,390,'acceso');
 await page.screenshot({path:`${dir}/390-acceso.png`,fullPage:true});
 if(BASE.endsWith('4174')){
  const other=await page.goto(BASE+'/iniciar',{waitUntil:'domcontentloaded'});
  if(other?.status()!==404)throw new Error('Merchant origin served customer page');
  const worker=await page.request.get(BASE+'/sw.js');
  if(worker.status()!==404)throw new Error('Customer service worker leaked');
 }
 await ctx.close();
}
// Additional final-design QA: review genuine onboarding and MFA-protected
// admin page shapes with strictly synthetic read-only accounts.
for(const [role,path,heading,width] of [
 ['customer','/restaurante/alta','Activa tu restaurante en Tala Eats.',390],
 ['admin','/admin/solicitudes-restaurantes','Activación de restaurantes',1280]
]){
 const ctx=await browser.newContext({viewport:{width,height:870},reducedMotion:'reduce'});
 await ctx.route('**/api/v1/**',route=>routeApi(route,role));
 const page=await ctx.newPage();
 page.on('pageerror',err=>{console.error('MERCHANT FINAL-SCREEN ERROR:',err.message);process.exitCode=1;});
 await page.goto(BASE+path,{waitUntil:'networkidle'});
 await page.getByRole('heading',{name:heading,exact:true}).waitFor({timeout:12000});
 await checkViewport(page,width,role+'-final');
 await page.screenshot({path:`${dir}/${width}-${role}-activacion.png`,fullPage:true});
 await ctx.close();
}
if(writeRequests>0)throw new Error('Se intentó escribir en el servidor durante el QA visual: '+writeRequests);
await browser.close();
console.log('RESTAURANT_VISUAL_QA=PASS widths='+widths.join(',')+' synthetic=YES writes=0 real_credentials=0');

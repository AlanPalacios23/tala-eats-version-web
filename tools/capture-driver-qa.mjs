import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';

const ORIGIN='http://127.0.0.1:4173';
const dir='artifacts/driver-visual';
mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
let captures=0;
const reply=(route,json,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(json)});
const driver={id:55,name:'Repartidor Demo',email:'driver@example.test',role:'driver'};
const dashboard={user:{name:driver.name,phone:''},profile:{vehicle:'Motocicleta',plate:'ABC-1234',is_verified:true},
 today:{earnings:0,deliveries:0,distance_km:0,average_earning:0},last_7_days:Array.from({length:7},(_,i)=>({date:'2026-10-'+String(21+i),earnings:0,deliveries:0}))};
const driverApi=(route)=>{
 const url=new URL(route.request().url());
 const path=url.pathname.replace('/api/v1','');
 if(path==='/auth/me')return reply(route,driver);
 if(path==='/driver/profile')return reply(route,{is_online:false,is_verified:true,vehicle:'Motocicleta',plate:'ABC-1234'});
 if(path==='/driver/presence-readiness')return reply(route,{environment:'staging',presence_enabled:true,admin_verified:true,online:false,fresh_gps:false,ready_for_dispatch:false});
 if(path==='/driver/dashboard')return reply(route,dashboard);
 if(path==='/driver/mine'||path==='/driver/available')return reply(route,[]);
 return reply(route,{error:'UNHANDLED_SYNTHETIC_ROUTE'},404);
};
try{
 for(const width of [320,360,390,430]){
  const context=await browser.newContext({viewport:{width,height:850},deviceScaleFactor:1,serviceWorkers:'block'});
  const page=await context.newPage();
  await page.route('**/api/v1/**',driverApi);
  await page.goto(ORIGIN+'/repartidor',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Hola, Repartidor'}).waitFor({timeout:12000});
  assert.equal(await page.getByRole('navigation',{name:'Navegación de repartidor'}).count(),1);
  assert.equal(await page.locator('.header-cart').count(),0);
  assert.equal(await page.locator('.df-bottom-nav button').count(),4);
  const homeAction=page.locator('.df-home-action');
  assert.equal(await homeAction.count(),1,'Flutter Home fixed action missing at '+width);
  assert.equal(await homeAction.getByRole('button',{name:'Conectarme'}).count(),1);
  const dock=await page.evaluate(()=>{
   const action=document.querySelector('.df-home-action')?.getBoundingClientRect();
   const nav=document.querySelector('.df-bottom-nav')?.getBoundingClientRect();
   return {ctaBottom:action?.bottom,navTop:nav?.top};
  });
  assert.ok(Math.abs(dock.ctaBottom-dock.navTop)<=2,'thumb CTA must touch navigation at '+width);

  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'horizontal overflow at '+width);
  await page.screenshot({path:`${dir}/home-${width}.png`,fullPage:true});captures++;
  for(const [label,heading] of [['Entregas','Entregas'],['Ganancias','Ganancias'],['Perfil','Perfil']]){
   await page.getByRole('button',{name:label,exact:true}).click();
   await page.getByRole('heading',{name:heading,exact:true}).waitFor();
   if(label==='Ganancias'){
    assert.equal(await page.locator('.df-week-chart .df-week-day').count(),7);
    assert.equal(await page.locator('.df-no-earnings').count(),1);
    await page.locator('.df-week-day').first().click();
    assert.equal(await page.locator('.df-week-day').first().getAttribute('aria-pressed'),'true');
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'overflow '+label+' at '+width);
   await page.screenshot({path:`${dir}/${label.toLowerCase()}-${width}.png`,fullPage:true});captures++;
  }
  await page.getByRole('button',{name:'Vehículo'}).click();
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByRole('dialog').getByText(/•••• 34/).count(),1);
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:850},serviceWorkers:'block'});
 const page=await context.newPage();
 await page.route('**/api/v1/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/v1/auth/me')return reply(route,{error:'unauthenticated'},401);
  if(path==='/api/v1/operations/onboarding-capabilities')return reply(route,{
   driver_plate_supported:true,driver_documents_supported:true,driver_admin_approval_required:true
  });
  return reply(route,{error:'UNHANDLED_SYNTHETIC_ROUTE'},404);
 });
 await page.goto(ORIGIN+'/repartidor/acceso');
 await page.getByRole('heading',{name:'Entra y empieza tu ruta.'}).waitFor();
 const logo=await page.locator('.df-brand img').evaluate(img=>({w:img.naturalWidth,h:img.naturalHeight,complete:img.complete}));
 assert.deepEqual(logo,{w:418,h:418,complete:true},'must reuse exact Flutter original logo');
 await page.screenshot({path:`${dir}/acceso-390.png`,fullPage:true});captures++;
 await page.goto(ORIGIN+'/repartidor/registro');
 await page.getByRole('heading',{name:'Únete a la red de repartidores.'}).waitFor();
 await page.getByText('Número de placas').waitFor();
 await page.getByRole('button',{name:'Crear cuenta y enviar solicitud'}).waitFor();
 await page.screenshot({path:`${dir}/registro-390.png`,fullPage:true});captures++;
 await context.close();
 console.log('DRIVER_FLUTTER_VISUAL_QA=PASS');
 console.log('DRIVER_VIEWS=4 SIZES=320,360,390,430 SCREENSHOTS='+captures);
 console.log('DRIVER_LOGO_ORIGINAL=PASS CTA_DOCKED=PASS WEEK_INTERACTIVE=PASS');
 console.log('DRIVER_MOCK_ONLY=YES LIVE_TRANSACTIONS=0');
}finally{await browser.close();}

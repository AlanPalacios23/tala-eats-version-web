/**
 * Tala Eats — Stripe Connect merchant sandbox E2E, NO REAL NETWORK TO STRIPE.
 * All API responses and permitted state-changing requests are intercepted.
 * This is a UI/business-state simulation, not a bank withdrawal/payout.
 *
 * Run after starting merchant-only bundle on 127.0.0.1:4174:
 *   node tools/simulate-wallet-stripe-connect.mjs
 */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const BASE=process.env.RESTAURANT_QA_ORIGIN||'http://127.0.0.1:4174';
const baseUrl=new URL(BASE);
if(baseUrl.hostname!=='127.0.0.1'&&baseUrl.hostname!=='localhost')
 throw Error('La simulación solo puede ejecutarse sobre un origen loopback.');
const outDir=process.env.RESTAURANT_QA_DIR||'artifacts/restaurant-standalone';
await mkdir(outDir,{recursive:true});

const time=new Date().toISOString();
const merchant={
 id:11,name:'Restaurante SIMULADO',cuisine:'Comida de prueba',description:'Datos ficticios',
 address:'Dirección de prueba, Jalisco',market_code:'TALA-JAL',eta_min:30,
 is_open:true,pickup_enabled:true,verification_status:'verified',
 lat:20.65,lng:-103.70,menu_items:[]
};
const orders=[
 {id:8101,restaurant_id:11,status:'delivered',order_type:'pickup',
 payment_method:'stripe',payment_status:'paid',created_at:time,total:'100.00',
 subtotal:'100.00',items:[{name_snapshot:'Pedido ficticio',quantity:1,unit_price:'100.00'}]}
];
const finance={
 restaurant_id:11,commercial_plan:'FAIR',commission_rate:'0.15',
 gross_food_sales:'100.00',commission:'15.00',net_payable:'85.00',orders:1,payouts:[]
};
const earnings={
 restaurant_id:11,currency:'MXN',unit:'centavos',transfer_not_executed:true,
 earnings_by_status:[{state:'held',total_minor:'8500',orders:'1'}],
 physical_cash_due_to_platform:[]
};
const stages={
 linked:{owner_approved:false,transfers_active:false,payouts_enabled:false,details_submitted:false,ready:false},
 awaitingStripe:{owner_approved:true,transfers_active:false,payouts_enabled:false,details_submitted:false,ready:false},
 ready:{owner_approved:true,transfers_active:true,payouts_enabled:true,details_submitted:true,ready:true}
};
let connect=null;
const calls={reads:0,ownerConfirm:0,onboardingLinks:0,remoteStripeRequestsIntercepted:0,
 payoutAttempts:0,otherWrites:0,blockedExternal:0};
const simulatedStripeUrl='https://connect.stripe.com/setup/s/tala-eats-synthetic-no-live-token';
const evidence=[];

const browser=await chromium.launch({headless:true});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},
  serviceWorkers:'block',reducedMotion:'reduce'});
 await ctx.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),method=req.method(),path=url.pathname;
  if(url.hostname==='connect.stripe.com'){
   calls.remoteStripeRequestsIntercepted++;
   if(method!=='GET'||url.href!==simulatedStripeUrl)
    throw Error('Unexpected external Stripe request in simulation');
   // Fulfill LOCALLY: no TCP/HTTPS call is made to Stripe.
   await route.fulfill({status:200,contentType:'text/html; charset=utf-8',
    body:'<!doctype html><title>Stripe Connect — SIMULADO</title><h1>Onboarding simulado · sin datos bancarios</h1>'});
   return;
  }
  if(url.origin!==baseUrl.origin){
   calls.blockedExternal++;
   await route.abort('blockedbyclient');
   return;
  }
  if(!path.startsWith('/api/v1/')){await route.continue();return;}
  const reply=async(status,body)=>route.fulfill({
   status,contentType:'application/json',body:JSON.stringify(body)
  });
  if(method==='GET'){
   calls.reads++;
   const data=new Map([
    ['/api/v1/auth/me',{id:12,name:'Dueño SIMULADO',email:'test@example.test',role:'restaurant'}],
    ['/api/v1/owner/restaurant',merchant],
    ['/api/v1/owner/orders',orders],
    ['/api/v1/owner/analytics',{orders:1,delivered:1,gross_sales:100,inventory_low:0}],
    ['/api/v1/owner/finance',finance],
    ['/api/v1/owner/finance/earnings/11',earnings]
   ]);
   if(path==='/api/v1/owner/finance/connect/11/status')
    return connect===null?reply(404,{detail:'Sin cuenta vinculada — simulación'}):
     reply(200,{...connect,restaurant_id:11});
   return data.has(path)?reply(200,data.get(path)):
    reply(404,{detail:'Ruta fuera del escenario sintético'});
  }
  if(path==='/api/v1/owner/finance/connect/11/confirm'&&method==='POST'){
   calls.ownerConfirm++;
   if(connect===null||connect.owner_approved)
    return reply(409,{detail:'Estado de consentimiento inválido'});
   connect={...stages.awaitingStripe};
   return reply(200,{owner_confirmed:true});
  }
  if(path==='/api/v1/owner/finance/connect/11/onboarding-link'&&method==='POST'){
   calls.onboardingLinks++;
   if(!connect?.owner_approved||connect?.ready)
    return reply(409,{detail:'El paso de Stripe no corresponde'});
   return reply(200,{url:simulatedStripeUrl,expires_at:Math.floor(Date.now()/1000)+300});
  }
  if(/payout|withdraw|transfer|payment|charge|refund|disburse/i.test(path))
   calls.payoutAttempts++;
  else calls.otherWrites++;
  return reply(403,{detail:'Escritura bloqueada en simulación'});
 });
 const page=await ctx.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const visit=async()=>{await page.goto(BASE+'/restaurante',{waitUntil:'networkidle'});
  await page.locator('[data-restaurant-app="true"]').waitFor({timeout:15000});};
 const nav=page.locator('.rp-mobile-tabs');
 const goWallet=async()=>{await nav.getByRole('button',{name:'Wallet',exact:true}).click();
  await page.locator('[data-merchant-wallet="true"]').waitFor({timeout:10000});};
 const ensureBlockedWithdrawal=async(label)=>{
  await page.getByRole('button',{name:/Retirar ganancias/}).click();
  const dialog=page.getByRole('dialog',{name:'Retirar ganancias'});
  await dialog.waitFor();
  await dialog.getByText('Los retiros bancarios aún no están habilitados').waitFor();
  await dialog.getByText('No disponible',{exact:true}).waitFor();
  await dialog.getByText('No iniciada',{exact:true}).waitFor();
  if(await dialog.getByRole('button',{name:/Transferir|Enviar dinero|Confirmar retiro/}).count())
   throw Error('Botón peligroso de dinero mostrado en '+label);
  evidence.push({step:label,result:'Retiro bloqueado — no hay saldo retirable validado ni POST'});
  return dialog;
 };
 await visit();
 await goWallet();
 let dialog=await ensureBlockedWithdrawal('Wallet antes de vincular Connect');
 await dialog.getByRole('button',{name:/Ver activación de Stripe Connect/}).click();
 await page.getByRole('heading',{name:'Activación',exact:true}).waitFor();
 await page.getByText('Tu cuenta todavía no aparece vinculada').waitFor();
 evidence.push({step:'Sin mapping de administración',result:'Guía para vincular; sin aprobación automática'});
 if(calls.ownerConfirm||calls.onboardingLinks)throw Error('Se creó una escritura sin cuenta vinculada');
 
 // Simulate verified ADMIN mapping in the TEST fixture, not an admin API request.
 connect={...stages.linked};
 await page.getByRole('button',{name:'Verificar estado de nuevo'}).click();
 await page.getByText('Autoriza tu cuenta de cobro').waitFor();
 const approve=page.getByRole('button',{name:'Confirmar mi titularidad'});
 if(await approve.isEnabled())throw Error('Owner approval did not require explicit consent');
 await page.locator('.rp-connect-consent input[type=checkbox]').check();
 if(!await approve.isEnabled())throw Error('Consent did not unlock owner approval');
 page.once('dialog',d=>void d.accept());
 await approve.click();
 await page.getByText('Completa tu verificación',{exact:true}).waitFor();
 if(calls.ownerConfirm!==1)throw Error('Owner consent API should be invoked exactly once');
 evidence.push({step:'Mapping ADMIN ficticio + propietario',result:'Checkbox y confirmación; POST confirm interceptado 1 vez'});
 
 // The browser MUST NOT leave the test runner to Stripe's actual servers.
 await page.getByRole('button',{name:/Continuar de forma segura en Stripe/}).click();
 await page.waitForURL(simulatedStripeUrl,{timeout:15000});
 await page.getByRole('heading',{name:/Onboarding simulado/}).waitFor();
 if(calls.onboardingLinks!==1||calls.remoteStripeRequestsIntercepted!==1)
  throw Error('Account Link not generated exactly once and intercepted');
 evidence.push({step:'Account Link',result:'URL Stripe HTTPS validada y pantalla Stripe local simulada; cero conexiones remotas'});
 
 // Simulate callback after Stripe KYC completion; the UI MUST re-read backend.
 connect={...stages.ready};
 await visit();
 await nav.getByRole('button',{name:'Más',exact:true}).click();
 await page.locator('.rm-flutter-settings').getByRole('button',{name:/Activación de pagos/}).click();
 await page.getByText('Tu conexión está verificada').waitFor();
 evidence.push({step:'Retorno de Stripe y estado ready',result:'Backend falso informa ready=true; app verifica pasos'});
 await goWallet();
 if(await page.locator('.mw-connect').count())
  throw Error('Connect ready: Wallet still displays a pending setup banner');
 dialog=await ensureBlockedWithdrawal('Wallet después de Connect ready');
 if(await dialog.getByRole('button',{name:/Ver activación de Stripe Connect/}).count())
  throw Error('Connect ready cannot be represented as pending activation');
 await dialog.getByRole('button',{name:'Entendido'}).click();
 if(await page.getByRole('dialog',{name:'Retirar ganancias'}).count())
  throw Error('Financial modal did not close');
 if(calls.payoutAttempts!==0||calls.otherWrites!==0)
  throw Error('A LIVE-like financial or unexpected write was attempted');
 if(calls.blockedExternal!==0)
  throw Error('An unexpected external origin was contacted');
 if(errors.length)throw Error('Browser runtime errors: '+errors.join('; '));
 await page.screenshot({path:outDir+'/390-stripe-connect-wallet-simulation.png',fullPage:true});
 const report={
  kind:'SYNTHETIC_ONLY',stripeMode:'MOCK',liveStripeNetworkRequests:0,
  realTransfers:0,realCharges:0,realPayouts:0,merchant:'FICTIONAL',
  result:'PASS',steps:evidence,calls
 };
 await writeFile(outDir+'/stripe-connect-wallet-simulation.json',
  JSON.stringify(report,null,2)+'\n','utf8');
 console.log('STRIPE_CONNECT_WALLET_SIMULATION=PASS');
 console.log('CONNECTION=MOCK OWNER_CONFIRM=1 ONBOARDING_LINK=1 READY=TRUE');
 console.log('BANK_WITHDRAWAL=BLOCKED LIVE_PAYOUTS=0 LIVE_CHARGES=0 LIVE_TRANSFERS=0');
 console.log('JSON_REPORT='+outDir+'/stripe-connect-wallet-simulation.json');
 await ctx.close();
}finally{await browser.close();}

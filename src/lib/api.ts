import { verifyMarketPage } from './markets';
import { resolveCustomerImage } from './customer-media';
import { PREVIEW_READONLY, previewRequestAllowed } from './preview';
import type { StripeTestConfig, StripeIntentReply } from './stripe-test';
import { normalizeCustomerAddress } from './customer-checkout';
import type { DriverPresenceReadiness } from './driver-presence';
import type { CheckoutRequest, CustomerAddress } from './customer-checkout';
import type { MarketCode } from './markets';
import type { AuthResponse, DriverProfile, MenuItem, Order, PaymentOptions, Quote, Restaurant, User } from './types';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = 'ApiError'; }
}
const BASE = '/api/v1';
/**
 * Give read-only requests a bounded lifetime so mobile screens never spin
 * forever on unreachable APIs. Writes also have a bounded client wait, but
 * they must NOT be auto-retried: checkout holds a pending idempotency journal.
 */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Ruta API inválida');
  const method=(init.method??'GET').toUpperCase();
  if(!previewRequestAllowed(path,method,PREVIEW_READONLY))
    throw new ApiError(403,'Vista previa: las operaciones de escritura están bloqueadas.');
  const controller=new AbortController();
  let timedOut=false;
  const forwardAbort=()=>controller.abort();
  if(init.signal?.aborted)controller.abort();
  else init.signal?.addEventListener('abort',forwardAbort,{once:true});
  const timer=globalThis.setTimeout(()=>{timedOut=true;controller.abort();},method==='GET'?25000:45000);
  try {
    const response=await fetch(BASE+path,{
      ...init,signal:controller.signal,
      credentials:'include',cache:'no-store',
      headers:{
        'Accept':'application/json',
        'X-Talaeats-Client':'web-pwa',
        ...(init.body?{'Content-Type':'application/json'}:{}),
        ...init.headers,
      },
    });
    if(response.status===204)return undefined as T;
    const raw=await response.text();
    let body:unknown;
    try{body=raw?JSON.parse(raw):null;}catch{throw new ApiError(502,'El servidor devolvió una respuesta que no pudimos interpretar.');}
    if(!response.ok){
      const details=body&&typeof body==='object'?body as Record<string,unknown>:null;
      const supplied=details?.detail??details?.error;
      const known:Record<string,string>={
        SELLER_CONNECT_NOT_APPROVED:'El restaurante todavía no está autorizado para recibir pedidos reales. Contacta al comercio.',
        SELLER_CONNECT_NOT_READY:'El restaurante debe terminar de verificar su cuenta Stripe Connect antes de aceptar pedidos.',
        SELLER_CONNECT_VERIFICATION_UNAVAILABLE:'No se pudo verificar el comercio en Stripe. No se creó el pedido.',
        LIVE_FINANCIAL_RECONCILIATION_HOLD:'Stripe está conciliando pagos. No vuelvas a cobrar hasta verificar el estado.',
        LIVE_CARD_CHECKOUT_NOT_APPROVED:'El pago con tarjeta LIVE no está habilitado para este comercio.',
        PAYMENT_RECONCILIATION_REQUIRED:'El pago requiere revisión. Comprueba el pedido antes de intentar nuevamente.',
      };
      const msg=typeof supplied==='string'&&supplied.length<500
        ?known[supplied]??supplied:'No pudimos completar la solicitud.';
      throw new ApiError(response.status,msg);
    }
    if(body===null&&raw==='')throw new ApiError(502,'El servidor respondió sin los datos esperados.');
    return body as T;
  }catch(err){
    if(err instanceof ApiError)throw err;
    if(timedOut)throw new ApiError(408,'El servidor tardó demasiado en responder. Revisa tu conexión y consulta el estado antes de reintentar.');
    if(err instanceof TypeError)throw new ApiError(0,'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
    throw err;
  }finally{
    globalThis.clearTimeout(timer);
    init.signal?.removeEventListener('abort',forwardAbort);
  }
}
const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });
async function uploadRestaurantDocument(file:File):Promise<{url:string;name:string}>{
  if(!previewRequestAllowed('/uploads/onboarding-document','POST',PREVIEW_READONLY))
   throw new ApiError(403,'En vista previa no es posible subir documentos.');
  if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type) ||
    !file.size || file.size>5*1024*1024)
   throw new ApiError(422,'Adjunta JPG, PNG, WEBP o PDF de máximo 5 MB.');
  const form=new FormData();
  form.append('file',file,file.name);
  const controller=new AbortController();
  const timeout=globalThis.setTimeout(()=>controller.abort(),45000);
  try{
   const response=await fetch(BASE+'/uploads/onboarding-document',{
    method:'POST',body:form,credentials:'include',cache:'no-store',
    signal:controller.signal,headers:{Accept:'application/json','X-Talaeats-Client':'web-pwa'}
   });
   const body=await response.json() as {url?:unknown;name?:unknown;error?:unknown};
   if(!response.ok)throw new ApiError(response.status,
     typeof body.error==='string'?body.error:'No fue posible subir el documento.');
   if(typeof body.url!=='string'||typeof body.name!=='string'||
      !/^\/api\/v1\/uploads\/onboarding-document\/u[1-9][0-9]*-[A-Za-z0-9_-]{32}\.(?:jpg|png|webp|pdf)$/.test(body.url))
    throw new ApiError(502,'La subida no devolvió una referencia segura del servidor.');
   return {url:body.url,name:body.name};
  }catch(err){
   if(err instanceof ApiError)throw err;
   throw new ApiError(503,'No se pudo subir el documento. Revisa tu conexión.');
  }finally{globalThis.clearTimeout(timeout);}
}


async function uploadMerchantCatalogImage(file:File,endpoint:string):Promise<{url:string}>{
 if(!/^\/uploads\/catalog\/(?:restaurant-cover|menu\/[1-9][0-9]*)$/.test(endpoint))
  throw new ApiError(422,'Destino de fotografía no válido.');
 if(!previewRequestAllowed(endpoint,'POST',PREVIEW_READONLY))
  throw new ApiError(403,'Las fotografías no se publican desde la vista previa.');
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>5*1024*1024)
  throw new ApiError(422,'Selecciona una foto JPG, PNG o WEBP de hasta 5 MB.');
 const form=new FormData();form.append('file',file,file.name);
 const controller=new AbortController();
 const timer=globalThis.setTimeout(()=>controller.abort(),45000);
 try{
  const res=await fetch(BASE+endpoint,{
   method:'POST',body:form,credentials:'include',cache:'no-store',signal:controller.signal,
   headers:{Accept:'application/json','X-Talaeats-Client':'web-pwa'}
  });
  const body=await res.json() as {url?:unknown;error?:unknown;detail?:unknown};
  if(!res.ok)throw new ApiError(res.status,typeof body.error==='string'?body.error:'No se pudo publicar la fotografía.');
  if(typeof body.url!=='string'){
   throw new ApiError(502,'El backend no confirmó una URL de catálogo.');
  }
  const url=new URL(body.url,window.location.origin);
  const local=url.origin===window.location.origin;
  const stage=url.hostname==='api-stage-talaeats.alan-palacios-dev.com'&&url.protocol==='https:';
  if(!local&&!stage)throw new ApiError(502,'El servidor devolvió un origen de imagen no permitido.');
  if(!/^\/api\/v1\/uploads\/catalog\/[a-zA-Z0-9_-]{12,130}\.(?:jpg|png|webp)$/.test(url.pathname))
   throw new ApiError(502,'El backend devolvió una ruta de imagen inválida.');
  return {url:body.url};
 }catch(e){
  if(e instanceof ApiError)throw e;
  throw new ApiError(503,'No se pudo confirmar la subida; comprueba el catálogo antes de volver a intentarlo.');
 }finally{globalThis.clearTimeout(timer);}
}
export interface MerchantStaff {
 id:number;user_id:number;name:string;email:string;role:string;
}

export interface MerchantApplication {
  id:number;user_id:number;entity_type:'restaurant'|'driver';
  business_name:string;tax_id:string;status:'pending'|'needs_info'|'approved'|'rejected'|'suspended';
  notes:string;created_at:string;updated_at:string;
}
export interface WeeklyWalletStatement {
 currency:'MXN';unit:'centavos';kind:'restaurant'|'driver';payee_id:number;
 period_start:string;period_timezone:'America/Mexico_City';
 recorded_earnings_cents:string;pending_allocation_cents:string;
 cash_in_driver_custody_cents:string;
 cash_in_merchant_custody_unverified_cents:string;withdrawable_cents:string;
 bank_payout_confirmed:false;payment_to_bank_status:string;
 release_approved:false;status:string;completeness:string;
 items:Array<{order_id:number;earned_cents:string;allocation_state:string;
  payment_method:string;fulfillment:string;delivered_at:string;
  cash_collector_kind:string|null;cash_collector_id:number|null;
  cash_custody_status:string|null;financial_hold_reasons:string[]}>;
}
export interface MerchantEarnings {
  restaurant_id:number;currency:'MXN';unit:'centavos';
  earnings_by_status:Array<{state:string;total_minor:string;orders:string}>;
  physical_cash_due_to_platform:Array<{status:string;due_minor:string;orders:string}>;
  transfer_not_executed:true;
}
export interface MerchantFinance {
  restaurant_id:number;commercial_plan:string;commission_rate:string;
  gross_food_sales:string;commission:string;net_payable:string;orders:number;
  payouts:Array<{id:number;amount:string;status:string;period_start:string;period_end:string}>;
}
export const api = {
  login: (email: string, password: string, otp?: string) => request<AuthResponse>('/auth/login',json('POST',{email,password,...(otp?{otp}:{})})),
  register: (name: string, email: string, password: string) => request<AuthResponse>('/auth/register',json('POST',{name,email,password})),
  me: () => request<User>('/auth/me'),
  updateProfile: (name:string,phone:string) => request<User>('/auth/me',json('PATCH',{name,phone})),
  logout: () => request<void>('/auth/logout',json('POST')),
  privacyPreferences: () => request<Record<string,unknown>>('/v11/privacy/preferences'),
  updatePrivacyPreferences: (body:{personalization_opt_in:boolean;analytics_opt_in:boolean;marketing_opt_in:boolean}) => request<Record<string,unknown>>('/v11/privacy/preferences',json('PUT',body)),
  privacyRequest: (requestType:'export'|'delete') => request<Record<string,unknown>>('/v9/privacy',json('POST',{request_type:requestType})),
  restaurants: () => request<Restaurant[]>('/restaurants?limit=100&offset=0'),
  restaurantsForMarket: async (code:MarketCode):Promise<Restaurant[]> => {
    const found:Restaurant[]=[];const seen=new Set<number>();
    for(let page=0;page<20;page++){
      const rows=await request<Restaurant[]>(`/restaurants?market_code=${encodeURIComponent(code)}&limit=100&offset=${page*100}`);
      verifyMarketPage(code,rows,seen);found.push(...rows);
      if(rows.length<100)return found;
    }
    throw new ApiError(503,'El catálogo supera el máximo seguro de páginas.');
  },
  favorites: () => request<{id:number}[]>('/platform/favorites'),
  toggleFavorite: (id:number) => request<{favorite:boolean}>(`/platform/favorites/${id}`,json('POST')),
  restaurant: (id: number) => request<Restaurant>(`/restaurants/${id}`),
  paymentOptions: () => request<PaymentOptions>('/orders/payment-methods'),
  pickupReadiness: (restaurantId:number) => request<{
    restaurant_id:number;order_type:'pickup';ready:boolean;
    cash_enabled:boolean;stripe_enabled:boolean;reason:string;
  }>(`/restaurants/${restaurantId}/pickup-readiness`),
  deliveryReadiness: (restaurantId:number) => request<{
    restaurant_id:number;order_type:'delivery';ready:boolean;
    cash_enabled:boolean;stripe_enabled:boolean;reason:string;
  }>(`/restaurants/${restaurantId}/delivery-readiness`),
  stripeTestConfig: () => request<StripeTestConfig>('/payments/stripe/config'),
  stripeTestIntent: (orderId:number) => request<StripeIntentReply>(`/payments/stripe/orders/${orderId}/payment-intent`,json('POST')),
  stripePaymentStatus: (orderId:number) => request<{
    order_id:number;provider:string;mode:'live'|'test';payment_status:string;
    order_status:string;confirmed_by_server:boolean;amount:string;currency:string;
  }>(`/payments/stripe/orders/${orderId}/status`),
  liveOrder: (orderId:number) => request<{order:Order}>(`/v11/orders/${orderId}/live`),
  customerOrderChat: (id:number) => request<{id?:number;sender_id:number;message:string;created_at?:string}[]>(`/platform/orders/${id}/chat`),
  sendCustomerOrderChat: (id:number,message:string) => request<{id?:number;sender_id:number;message:string;created_at?:string}>(`/platform/orders/${id}/chat`,json('POST',{message,message_type:'text',media_url:''})),
  customerAddresses: async ():Promise<CustomerAddress[]> => {const raw=await request<unknown>('/platform/addresses');if(!Array.isArray(raw))throw new ApiError(502,'El servidor no devolvió direcciones válidas.');return raw.map(normalizeCustomerAddress);},
  wallet: () => request<{balance:string|number;points:number;plus_member?:boolean;referral_code?:string;tier?:string;transactions?:{id?:number;kind?:string;description?:string;amount?:number|string;created_at?:string}[]}>('/platform/wallet'),
  redeemReward: () => request<Record<string,unknown>>('/platform/rewards/redeem?points=500',json('POST')),
  customerNotifications: () => request<{id:number;kind:string;title:string;message:string;is_read:boolean;created_at:string}[]>('/platform/notifications'),
  notificationRead: (id:number) => request<Record<string,unknown>>(`/platform/notifications/${id}/read`,json('PATCH')),
  notificationsReadAll: () => request<Record<string,unknown>>('/platform/notifications/read-all',json('POST')),
  supportTickets: () => request<{id:number;user_id?:number;order_id?:number|null;category?:string;message:string;status?:string;created_at?:string}[]>('/platform/support'),
  createSupportTicket: (category:string,message:string,orderId:number|null) => request<{id:number;message:string;category?:string;status?:string}>('/platform/support',json('POST',{category,message,order_id:orderId})),
  addCustomerAddress: async (body:{label:string;address:string;lat:number;lng:number;is_default:boolean}):Promise<CustomerAddress> => normalizeCustomerAddress(await request<unknown>('/platform/addresses',json('POST',body))),
  updateCustomerAddress: (id:number,body:{is_default:boolean}) => request<CustomerAddress>(`/platform/addresses/${id}`,json('PATCH',body)),
  deleteCustomerAddress: (id:number) => request<void>(`/platform/addresses/${id}`,json('DELETE')),
  geocode: (address:string) => request<{results:{lat:number;lng:number}[]}>('/v11/maps/geocode',json('POST',{query:address+', Jalisco, México',limit:1})),
  checkoutQuote: (body:CheckoutRequest) => request<Quote>(body.order_type==='delivery'?'/orders/delivery-quote':'/orders/quote',json('POST',body)),
  createCheckoutOrder: (body:CheckoutRequest,reference:string,notes:string,addressText:string) => request<Order>('/orders',json('POST',{...body,address:addressText,notes,client_reference:reference})),
  quote: (restaurantId:number, items:{menu_item_id:number;quantity:number;options:string}[]) => request<Quote>('/orders/quote',json('POST', {
    restaurant_id:restaurantId,order_type:'pickup',payment_method:'cash',items,tip:'0',coupon_code:'',delivery_lat:null,delivery_lng:null
  })),
  placeCashPickup: (restaurantId:number, items:{menu_item_id:number;quantity:number;options:string}[],reference:string,notes:string) => request<Order>('/orders',json('POST',{
    restaurant_id:restaurantId,address:'Recoger en el establecimiento',notes,order_type:'pickup',payment_method:'cash',client_reference:reference,items,tip:'0',coupon_code:'',delivery_lat:null,delivery_lng:null,
  })),
  byReference: (ref: string) => request<Order>(`/orders/by-reference/${encodeURIComponent(ref)}`),
  myOrders: () => request<Order[]>('/orders/mine?limit=100&offset=0'),
  restaurantOnboardingMine: () => request<MerchantApplication[]>('/onboarding/mine'),
  restaurantOnboardingDocument: (file:File) => uploadRestaurantDocument(file),
  restaurantOnboardingSubmit: (businessName:string,taxId:string,documents:string[]=[]) => request<MerchantApplication>(
    '/onboarding',json('POST',{
      entity_type:'restaurant',business_name:businessName,tax_id:taxId,
      vehicle:'',payout_account_ref:'',documents,
    })),
  adminRestaurantApplications: () => request<MerchantApplication[]>('/admin/onboarding'),
  adminReviewRestaurantApplication: (applicationId:number,status:'approved'|'rejected'|'needs_info'|'suspended',notes:string) =>
    request<MerchantApplication>(`/admin/onboarding/${applicationId}`,json('PATCH',{status,notes})),
  ownerFinance: () => request<MerchantFinance>('/owner/finance'),
  ownerEarnings: (restaurantId:number) => request<MerchantEarnings>(`/owner/finance/earnings/${restaurantId}`),
  ownerWeeklyWallet: (id:number) => request<WeeklyWalletStatement>(`/owner/wallet/weekly/${id}`),
  driverWeeklyWallet: () => request<WeeklyWalletStatement>('/driver/wallet/weekly'),
  ownerRestaurant: () => request<Restaurant>('/owner/restaurant'),
  ownerOrders: () => request<Order[]>('/owner/orders?limit=200&offset=0'),
  ownerEmployees: () => request<MerchantStaff[]>('/owner/employees'),
  ownerInviteEmployee: (email:string,role:'manager'|'cashier'|'kitchen') => request<MerchantStaff>(`/owner/employees?email=${encodeURIComponent(email)}&role=${encodeURIComponent(role)}`,json('POST')),
  ownerDeleteItem: (id:number) => request<void>(`/owner/menu/${id}`,{method:'DELETE'}),
  ownerUploadCover: (file:File) => uploadMerchantCatalogImage(file,'/uploads/catalog/restaurant-cover'),
  ownerUploadItemPhoto: (id:number,file:File) => uploadMerchantCatalogImage(file,`/uploads/catalog/menu/${id}`),
  ownerAnalytics: () => request<{orders:number;delivered:number;gross_sales:number;inventory_low:number}>('/owner/analytics'),
  ownerUpdateStatus: (id:number,status:'confirmed'|'preparing'|'ready') => request<Order>(`/owner/orders/${id}/status`,json('PATCH',{status})),
  ownerCompletePickup: (id:number,pin:string) => request<Order>(`/owner/orders/${id}/complete`,
    json('POST',{pin,photo_url:''})),
  adminConnectMap: (restaurantId:number,stripeAccountId:string) =>
    request<{restaurant_id:number;status:string}>('/admin/finance/connect-map',
      json('POST',{restaurant_id:restaurantId,stripe_account_id:stripeAccountId})),
  adminConnectStatus: (restaurantId:number) => request<{
    restaurant_id:number;owner_approved:boolean;charges_enabled:boolean;
    transfers_active:boolean;payouts_enabled:boolean;details_submitted:boolean;
    transfer_automation_enabled:boolean;
  }>(`/admin/finance/connect/${restaurantId}/status`),
  ownerConnectStatus: (restaurantId:number) => request<{
    owner_approved:boolean;transfers_active:boolean;
    payouts_enabled:boolean;details_submitted:boolean;ready?:boolean;
  }>(`/owner/finance/connect/${restaurantId}/status`),
  ownerConfirmConnect: (restaurantId:number) => request<{owner_confirmed:boolean}>(
    `/owner/finance/connect/${restaurantId}/confirm`,json('POST',{})),
  ownerConnectOnboardingLink: (restaurantId:number) => request<{url:string;expires_at:number}>(
    `/owner/finance/connect/${restaurantId}/onboarding-link`,json('POST',{})),
  ownerUpdateRestaurant: (body:Partial<Pick<Restaurant,'name'|'description'|'cuisine'|'eta_min'|'is_open'|'pickup_enabled'|'address'|'lat'|'lng'>>) => request<Restaurant>('/owner/restaurant',json('PATCH',body)),
  ownerUpdateItem: (id:number, body:Partial<Pick<MenuItem,'stock'|'is_available'|'price'|'name'|'description'|'category'|'allergens'|'dietary_tags'|'is_combo'>>) => request<MenuItem>(`/owner/menu/${id}`,json('PATCH',body)),
  ownerAddItem: (body:{name:string;price:string;stock:number;description:string;category:string;is_available:boolean;allergens?:string;dietary_tags?:string;is_combo?:boolean}) => request<MenuItem>('/owner/menu',json('POST',body)),
  // Capability handshake is REQUIRED before offering registration: the current
  // LIVE RC8.13 server ignores plates, so do not create incomplete accounts.
  driverOnboardingCapabilities: () => request<{
    driver_plate_supported:boolean;driver_documents_supported:boolean;
    driver_admin_approval_required:boolean;
  }>('/operations/onboarding-capabilities'),
  driverOnboardingMine: () => request<Array<{
    id:number;entity_type:string;status:string;notes?:string;
  }>>('/operations/onboarding/mine'),
  driverOnboardingDocument: (file:File) => uploadRestaurantDocument(file),
  driverOnboardingSubmit: (vehicle:'Motocicleta'|'Automóvil'|'Bicicleta',plate:string,documents:string[]=[]) =>
    request<{id:number;status:string;entity_type:string}>('/operations/onboarding',
      json('POST',{entity_type:'driver',business_name:'',tax_id:'',
        vehicle,plate,payout_account_ref:'',documents})),
  driverProfile: () => request<DriverProfile>('/driver/profile'),
  driverDashboard: () => request<Record<string,unknown>>('/driver/dashboard'),
  driverMine: () => request<Order[]>('/driver/mine?limit=100'),
  driverAvailable: () => request<Order[]>('/driver/available?limit=25'),
  driverSetAvailability: (is_online:boolean) => request<DriverProfile>('/driver/availability',json('PATCH',{is_online})),
  driverLocation: (lat:number,lng:number) => request<DriverProfile>('/driver/location',json('PATCH',{lat,lng})),
  driverPresenceReadiness: () => request<DriverPresenceReadiness>('/driver/presence-readiness'),
  driverAccept: (id:number) => request<Order>(`/driver/orders/${id}/accept`,json('POST')),
  driverStatus: (id:number,status:'picked_up'|'on_the_way') => request<Order>(`/driver/orders/${id}/status`,json('PATCH',{status})),
  driverComplete: (id:number,pin:string) => request<Order>(`/driver/orders/${id}/complete`,json('POST',{pin,photo_url:''})),
  health: () => request<{status:string;version:string;production:boolean}>('/health'),
};
export function pesos(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n) : '—';
}
export function safeImage(url?: string|null): string | null {
  return resolveCustomerImage(url, window.location.origin);
}
export function isMerchantRole(role?:string) { return role==='restaurant'||role==='admin'; }
export function isDriverRole(role?:string) { return role==='driver'; }

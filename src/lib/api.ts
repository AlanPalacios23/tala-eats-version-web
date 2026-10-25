import { verifyMarketPage } from './markets';
import { PREVIEW_READONLY, previewRequestAllowed } from './preview';
import type { StripeTestConfig, StripeIntentReply } from './stripe-test';
import { normalizeCustomerAddress } from './customer-checkout';
import type { CheckoutRequest, CustomerAddress } from './customer-checkout';
import type { MarketCode } from './markets';
import type { AuthResponse, DriverProfile, MenuItem, Order, PaymentOptions, Quote, Restaurant, User } from './types';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = 'ApiError'; }
}
const BASE = '/api/v1';
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Ruta API inválida');
  if(!previewRequestAllowed(path,init.method??'GET',PREVIEW_READONLY))throw new ApiError(403,'Vista previa: las operaciones de escritura están bloqueadas.');
  const response = await fetch(BASE + path, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'Accept': 'application/json',
      'X-Talaeats-Client': 'web-pwa',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const raw = await response.text();
  let body: unknown;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
  if (!response.ok) {
    const msg = body && typeof body === 'object' ?
      String((body as Record<string,unknown>).detail ?? (body as Record<string,unknown>).error ?? 'No pudimos completar la solicitud') :
      'No pudimos completar la solicitud';
    throw new ApiError(response.status, msg);
  }
  return body as T;
}
const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });
export const api = {
  login: (email: string, password: string, otp?: string) => request<AuthResponse>('/auth/login',json('POST',{email,password,...(otp?{otp}:{})})),
  register: (name: string, email: string, password: string) => request<AuthResponse>('/auth/register',json('POST',{name,email,password})),
  me: () => request<User>('/auth/me'),
  updateProfile: (name:string,phone:string) => request<User>('/auth/me',json('PATCH',{name,phone})),
  logout: () => request<void>('/auth/logout',json('POST')),
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
  stripeTestConfig: () => request<StripeTestConfig>('/payments/stripe/config'),
  stripeTestIntent: (orderId:number) => request<StripeIntentReply>(`/payments/stripe/orders/${orderId}/payment-intent`,json('POST')),
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
  ownerRestaurant: () => request<Restaurant>('/owner/restaurant'),
  ownerOrders: () => request<Order[]>('/owner/orders?limit=100&offset=0'),
  ownerAnalytics: () => request<{orders:number;delivered:number;gross_sales:number;inventory_low:number}>('/owner/analytics'),
  ownerUpdateStatus: (id:number,status:'confirmed'|'preparing'|'ready') => request<Order>(`/owner/orders/${id}/status`,json('PATCH',{status})),
  ownerUpdateRestaurant: (body:{is_open:boolean}) => request<Restaurant>('/owner/restaurant',json('PATCH',body)),
  ownerUpdateItem: (id:number, body:Partial<Pick<MenuItem,'stock'|'is_available'|'price'|'name'|'description'>>) => request<MenuItem>(`/owner/menu/${id}`,json('PATCH',body)),
  ownerAddItem: (body:{name:string;price:string;stock:number;description:string;category:string;is_available:boolean}) => request<MenuItem>('/owner/menu',json('POST',body)),
  driverProfile: () => request<DriverProfile>('/driver/profile'),
  driverDashboard: () => request<Record<string,unknown>>('/driver/dashboard'),
  driverMine: () => request<Order[]>('/driver/mine?limit=100'),
  driverAvailable: () => request<Order[]>('/driver/available?limit=25'),
  driverSetAvailability: (is_online:boolean) => request<DriverProfile>('/driver/availability',json('PATCH',{is_online})),
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
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === 'https:' || (parsed.origin === window.location.origin && parsed.protocol === 'http:') ? parsed.href : null;
  } catch { return null; }
}
export function isMerchantRole(role?:string) { return role==='restaurant'||role==='admin'; }
export function isDriverRole(role?:string) { return role==='driver'; }

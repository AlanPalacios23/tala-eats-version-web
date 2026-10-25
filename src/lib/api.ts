import type { AuthResponse, DriverProfile, MenuItem, Order, PaymentOptions, Quote, Restaurant, User } from './types';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = 'ApiError'; }
}
const BASE = '/api/v1';
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Ruta API inválida');
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
  logout: () => request<void>('/auth/logout',json('POST')),
  restaurants: () => request<Restaurant[]>('/restaurants?limit=100&offset=0'),
  restaurant: (id: number) => request<Restaurant>(`/restaurants/${id}`),
  paymentOptions: () => request<PaymentOptions>('/orders/payment-methods'),
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

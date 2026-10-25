export type Role = 'customer' | 'restaurant' | 'driver' | 'admin' | string;
export interface User { id: number; name: string; email: string; role: Role; two_factor_enabled?: boolean; is_active?: boolean; }
export interface MenuItem { id: number; restaurant_id: number; name: string; description?: string; category?: string; price: string; is_available: boolean; stock: number; image_url?: string | null; }
export interface Restaurant { id: number; name: string; market_code?: string; description?: string; cuisine?: string; emoji?: string; eta_min?: number; is_open: boolean; pickup_enabled?: boolean; address?: string; rating?: string; cover_image_url?: string | null; menu_items?: MenuItem[]; verification_status?: string; }
export interface OrderItem { id?: number; menu_item_id?: number; name_snapshot: string; quantity: number; unit_price: string; }
export interface Order { id: number; restaurant_id: number; status: string; order_type: string; payment_method: 'cash'|'stripe'; payment_status: string; total: string; subtotal?: string; delivery_fee?: string; tip?: string; created_at: string; items: OrderItem[]; delivery_pin?: string | null; address?: string; driver_earning?: string; client_reference?: string; }
export interface PaymentMethod { id: string; label?: string; enabled: boolean; reason?: string; }
export interface PaymentOptions { methods: PaymentMethod[]; pickup_checkout_supported?: boolean; pickup_quote_supported?: boolean; delivery_checkout_supported?: boolean; delivery_cash_supported?: boolean; delivery_stripe_supported?: boolean; delivery_quote_supported?: boolean; }
export interface Quote { total: string | number; subtotal?: string | number; service_fee?: string | number; restaurant_total?: string | number; [key: string]: unknown; }
export interface DriverProfile { is_online?: boolean; is_verified?: boolean; vehicle?: string; rating?: string; total_deliveries?: number; }
export interface AuthResponse { access_token: string; user: User; }

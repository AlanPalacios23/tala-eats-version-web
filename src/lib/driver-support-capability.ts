/** Server-authoritative, fail-closed courier support capability.
 * The client-side environment flag is a second gate, never the source of truth.
 */
export type DriverSupportCapabilities={
 driver_ticket_enabled:boolean;
 driver_order_link_supported:boolean;
};
export function verifiedDriverSupportCapability(value:unknown):DriverSupportCapabilities|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const c=value as Record<string,unknown>;
 if(c.driver_ticket_enabled!==true||c.driver_order_link_supported!==true)return null;
 return {driver_ticket_enabled:true,driver_order_link_supported:true};
}
export function linkedDriverTicketOrderId(activeOrderId:unknown,enabled:boolean):number|null{
 return enabled&&typeof activeOrderId==='number'&&
  Number.isSafeInteger(activeOrderId)&&activeOrderId>0?activeOrderId:null;
}

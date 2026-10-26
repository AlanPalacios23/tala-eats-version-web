/** Pickup requires an exact four-digit server PIN; no client-side bypass.
 * This only validates user input; server independently validates ownership,
 * rate limits PIN attempts, checks signed Stripe payment and writes ledger.
 */
export function normalizePickupPin(input:string):string {
 return input.replace(/\D/g,'').slice(0,4);
}
export function validPickupPin(input:string):boolean{
 return /^\d{4}$/.test(input);
}

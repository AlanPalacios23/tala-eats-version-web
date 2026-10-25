/** Existing Cloudflare Tunnel public document endpoints. Do not show
 * duplicate legal forms in the checkout or authenticated Web shell.
 *
 * /privacidad and /eliminar-cuenta were verified as HTTP 200 on 2026-10-24.
 * /terminos is the expected legal slug but MUST be confirmed from Kali with
 * deploy/verify-legal-links.sh before anyone treats it as published.
 */
export const LEGAL_LINKS = Object.freeze({
 terms: 'https://talaeats.alan-palacios-dev.com/terminos',
 privacy: 'https://talaeats.alan-palacios-dev.com/privacidad',
 deletion: 'https://talaeats.alan-palacios-dev.com/eliminar-cuenta',
});
export function legalHref(kind:keyof typeof LEGAL_LINKS):string {
 return LEGAL_LINKS[kind];
}

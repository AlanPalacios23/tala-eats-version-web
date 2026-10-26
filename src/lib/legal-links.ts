/** Existing Cloudflare Tunnel public document endpoints. Do not show
 * duplicate legal forms in the checkout or authenticated Web shell.
 *
 * /privacidad and /eliminar-cuenta were verified as HTTP 200 on 2026-10-25.
 * No existing terminos slug responded HTTP 200 through the original API
 * tunnel, so a separate public document is shipped WITH this Web frontend.
 * It becomes accessible only AFTER deploying the new version to 18195.
 */
export const LEGAL_LINKS = Object.freeze({
 terms: 'https://web-talaeats.alan-palacios-dev.com/legal/terminos.html',
 privacy: 'https://talaeats.alan-palacios-dev.com/privacidad',
 deletion: 'https://talaeats.alan-palacios-dev.com/eliminar-cuenta',
});
export function legalHref(kind:keyof typeof LEGAL_LINKS):string {
 return LEGAL_LINKS[kind];
}

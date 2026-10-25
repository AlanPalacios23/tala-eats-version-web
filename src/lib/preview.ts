/**
 * REVIEW-only build gate. It is NOT a financial security boundary.
 * Nginx independently restricts upstream writes in the Kali preview.
 */
export const PREVIEW_READONLY = import.meta.env.VITE_PREVIEW_READONLY === 'true';
export function previewRequestAllowed(path:string,method:string,readonly:boolean):boolean{
 if(!readonly)return true;
 const normalized=method.toUpperCase();
 if(normalized==='GET'||normalized==='HEAD')return true;
 // Only authenticate existing test/reviewer accounts. Never register new
 // customers or initiate orders, payments, payouts or commerce mutations.
 return normalized==='POST'&&(path==='/auth/login'||path==='/auth/logout');
}

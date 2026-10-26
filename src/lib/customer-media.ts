/**
 * Public catalog media can be left with an absolute STAGING hostname after
 * importing a merchant into LIVE. The exact same immutable filenames were
 * verified by HEAD in the existing public /api/v1/uploads/catalog/* endpoint.
 *
 * Only canonicalize this trusted *public catalog* subdirectory. Never
 * rewrite private delivery proofs, onboarding documents, signed URLs, chat
 * media, payment links, arbitrary hosts, or customer supplied URLs.
 */
const STAGING_MEDIA_ORIGIN='https://api-stage-talaeats.alan-palacios-dev.com';
const CATALOG_FILE=/^\/api\/v1\/uploads\/catalog\/[A-Za-z0-9_-]{3,110}\.(?:jpe?g|png|webp)$/i;

export function resolveCustomerImage(input:string|null|undefined,frontendOrigin:string):string|null{
 if(typeof input!=='string'||!input.trim())return null;
 try{
  const origin=new URL(frontendOrigin);
  if(origin.origin!==frontendOrigin||!['https:','http:'].includes(origin.protocol)||origin.username||origin.password)return null;
  // Reject protocol-relative references, credentials and non-browser protocols.
  if(input.startsWith('//'))return null;
  const image=new URL(input,origin);
  if(image.username||image.password)return null;
  // Do not mistake an attacker-controlled lookalike for the pinned stage host.
  if(image.hostname.toLowerCase().startsWith('api-stage-talaeats.alan-palacios-dev.com.'))return null;
  if(image.origin===STAGING_MEDIA_ORIGIN){
   if(image.search||image.hash||!CATALOG_FILE.test(image.pathname))return null;
   // Same-origin URL traverses the existing /api/v1/ LIVE Nginx proxy.
   // Return the relative public path; don't add a new proxy service.
   return image.pathname;
  }
  if(image.protocol==='https:'||(image.protocol==='http:'&&image.origin===origin.origin)){
   return image.href;
  }
  return null;
 }catch{return null;}
}

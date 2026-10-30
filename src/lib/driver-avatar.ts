/** RC144: trusted immutable backend avatar only. Never render arbitrary links. */
export const DRIVER_AVATAR_PREFIX='/api/v1/driver/avatar/';
const avatarRx=/^\/api\/v1\/driver\/avatar\/[a-f0-9]{40}\.webp$/;
export function trustedDriverAvatarUrl(raw:unknown):string|null{
 return typeof raw==='string'&&avatarRx.test(raw)?raw:null;
}
/** On-device crop strips camera GPS/EXIF before upload; the backend repeats
 * full decode/re-encode and never trusts the browser's claimed MIME type. */
export async function prepareDriverAvatar(file:File):Promise<Blob>{
 if(!file||file.size<100||file.size>20*1024*1024)
  throw Error('La fotografía debe pesar menos de 20 MB.');
 if(!['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.type))
  throw Error('Selecciona una fotografía JPG, PNG, WEBP o HEIC compatible.');
 const url=URL.createObjectURL(file);
 try{
  const img=await new Promise<HTMLImageElement>((resolve,reject)=>{
   const item=new Image();item.onload=()=>resolve(item);
   item.onerror=()=>reject(Error('No se puede abrir esta foto. Prueba con JPG o PNG.'));
   item.src=url;
  });
  const w=img.naturalWidth,h=img.naturalHeight;
  if(!w||!h||w>12000||h>12000)throw Error('Dimensiones de foto no admitidas.');
  const canvas=document.createElement('canvas');
  canvas.width=512;canvas.height=512;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('El dispositivo no pudo preparar la foto.');
  const side=Math.min(w,h),x=(w-side)/2,y=(h-side)/2;
  ctx.drawImage(img,x,y,side,side,0,0,512,512);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(v=>{
   if(v)resolve(v);else reject(Error('No se pudo convertir la fotografía.'));
  },'image/webp',.84));
  if(!['image/webp','image/jpeg','image/png'].includes(blob.type)||blob.size>4*1024*1024)
   throw Error('La fotografía convertida supera el límite permitido.');
  return blob;
 }finally{URL.revokeObjectURL(url);}
}

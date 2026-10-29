/** Private onboarding evidence: browser-only preparation, never upload to third parties.
 * The server remains authoritative for document authorization, size and magic bytes.
 */
export const MAX_ONBOARDING_BYTES=5*1024*1024;
export const MAX_ONBOARDING_FILES=3;
const allowed={
 'image/jpeg':'.jpg',
 'image/png':'.png',
 'image/webp':'.webp',
 'application/pdf':'.pdf',
} as const;
type AllowedMime=keyof typeof allowed;

export function onboardingFileFormat(header:Uint8Array):AllowedMime|null{
 if(header.length>=3&&header[0]===0xff&&header[1]===0xd8&&header[2]===0xff)return 'image/jpeg';
 if(header.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>header[i]===v))return 'image/png';
 if(header.length>=12&&String.fromCharCode(...header.slice(0,4))==='RIFF'&&
    String.fromCharCode(...header.slice(8,12))==='WEBP')return 'image/webp';
 if(header.length>=5&&String.fromCharCode(...header.slice(0,5))==='%PDF-')return 'application/pdf';
 return null;
}
export function readableOnboardingSize(bytes:number):string{
 return (bytes/1024/1024).toFixed(1)+' MB';
}
export function onboardingSelectionError(files:readonly File[]):string|null{
 if(files.length>MAX_ONBOARDING_FILES)return 'Adjunta un máximo de 3 documentos.';
 if(files.some(file=>!file.size))return 'Uno de los documentos está vacío. Selecciona otro archivo.';
 return null;
}
function outputName(name:string,extension:string){
 const cleaned=name.replace(/\.[^/.]+$/,'').slice(0,100)||'documento';
 return cleaned+extension;
}
function isHeic(file:File,header:Uint8Array):boolean{
 const ft=String.fromCharCode(...header.slice(4,12));
 return /^(image\/hei[cf])$/.test(file.type.toLowerCase())||
        /\.hei[cf]$/i.test(file.name)||
        ft.startsWith('ftypheic')||ft.startsWith('ftypheix')||ft.startsWith('ftypmif1');
}
/** Only re-encode photographs if oversized or HEIC/HEIF. Keep legible originals otherwise. */
async function convertImageToJpeg(file:File):Promise<File>{
 if(typeof document==='undefined')throw new Error('Tu dispositivo no puede preparar esta fotografía. Usa JPG, PNG o PDF.');
 const objectUrl=URL.createObjectURL(file);
 const image=new Image();
 try{
   await new Promise<void>((resolve,reject)=>{
     image.onload=()=>resolve();
     image.onerror=()=>reject(new Error('No pudimos leer esta foto. Exporta la tarjeta de circulación como JPG o PDF.'));
     image.src=objectUrl;
   });
   if(!image.naturalWidth||!image.naturalHeight)throw new Error('La imagen no se puede leer.');
   for(const [maxEdge,quality] of [[3200,.92],[2800,.88],[2400,.84],[2200,.8]]){
     const scale=Math.min(1,maxEdge/Math.max(image.naturalWidth,image.naturalHeight));
     const canvas=document.createElement('canvas');
     canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
     canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
     const ctx=canvas.getContext('2d');
     if(!ctx)throw new Error('No se pudo procesar la imagen en este dispositivo.');
     // White paper background for ID images with transparent pixels.
     ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
     ctx.drawImage(image,0,0,canvas.width,canvas.height);
     const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
     if(blob&&blob.size&&blob.size<=MAX_ONBOARDING_BYTES){
       return new File([blob],outputName(file.name,'.jpg'),{type:'image/jpeg',lastModified:Date.now()});
     }
   }
   throw new Error('La foto es demasiado grande incluso después de optimizarla. Prueba fotografiar el documento con menor resolución.');
 }finally{URL.revokeObjectURL(objectUrl);}
}
export async function prepareOnboardingDocument(file:File):Promise<File>{
 if(!file.size)throw new Error('El archivo '+file.name+' está vacío.');
 const header=new Uint8Array(await file.slice(0,16).arrayBuffer());
 const actual=onboardingFileFormat(header);
 if(!actual){
   if(isHeic(file,header))return convertImageToJpeg(file);
   throw new Error('El archivo '+file.name+' no es JPG, PNG, WEBP o PDF válido. Guarda la foto como JPG o PDF.');
 }
 if(file.size>MAX_ONBOARDING_BYTES){
   if(actual==='application/pdf')throw new Error('El PDF '+file.name+' pesa '+readableOnboardingSize(file.size)+'. El límite es 5 MB; comprímelo antes de adjuntarlo.');
   return convertImageToJpeg(file);
 }
 // Android file providers sometimes supply an empty/octet-stream or wrong MIME.
 // Verify file signature first, then set the correct multipart MIME for the backend.
 if(file.type!==actual||!file.name.toLowerCase().endsWith(allowed[actual])){
   return new File([file],outputName(file.name,allowed[actual]),{type:actual,lastModified:file.lastModified});
 }
 return file;
}
export async function prepareOnboardingDocuments(files:readonly File[]):Promise<File[]>{
 const issue=onboardingSelectionError(files);
 if(issue)throw new Error(issue);
 const result:File[]=[];
 for(const file of files)result.push(await prepareOnboardingDocument(file));
 return result;
}

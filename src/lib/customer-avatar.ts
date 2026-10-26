/** Device-local customer avatar, matching Flutter's local profile photo.
 * No profile photo upload endpoint has been verified in the Node backend.
 * Never send the image to a server or pretend it is synced between devices.
 */
const DB='tala-eats-customer-avatars-v1',STORE='images',EVENT='tala-customer-avatar-change';
const MAX=2*1024*1024;
export async function validateAvatar(file:File):Promise<void>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size<=0||file.size>MAX)throw new Error('Usa una foto JPG, PNG o WebP de máximo 2 MB.');
 const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
 const jpeg=bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
 const webp=bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!(file.type==='image/jpeg'&&jpeg||file.type==='image/png'&&png||file.type==='image/webp'&&webp))throw new Error('El archivo no contiene una imagen válida.');
}
function database():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(new Error('El navegador no permite guardar fotografías localmente.'));return;}
  const op=indexedDB.open(DB,1);
  op.onupgradeneeded=()=>{if(!op.result.objectStoreNames.contains(STORE))op.result.createObjectStore(STORE);};
  op.onsuccess=()=>resolve(op.result);
  op.onerror=()=>reject(new Error('No se pudo acceder al almacenamiento de fotografías.'));
 });
}
async function transaction<T>(id:number,mode:IDBTransactionMode,run:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 if(!Number.isSafeInteger(id)||id<=0)throw new Error('Cuenta inválida.');
 const db=await database();
 try{return await new Promise<T>((resolve,reject)=>{
   const tr=db.transaction(STORE,mode),req=run(tr.objectStore(STORE));
   tr.oncomplete=()=>resolve(req.result);
   tr.onerror=()=>reject(new Error('No pudimos guardar la foto en este dispositivo.'));
   tr.onabort=()=>reject(new Error('Operación de foto cancelada.'));
 });}finally{db.close();}
}
export async function readLocalAvatar(id:number):Promise<Blob|null>{
 const x=await transaction<Blob|undefined>(id,'readonly',s=>s.get(id));
 return x instanceof Blob?x:null;
}
export async function saveLocalAvatar(id:number,file:File):Promise<void>{
 await validateAvatar(file);
 await transaction<IDBValidKey>(id,'readwrite',s=>s.put(file,id));
 window.dispatchEvent(new CustomEvent(EVENT,{detail:{userId:id}}));
}
export async function removeLocalAvatar(id:number):Promise<void>{
 await transaction<undefined>(id,'readwrite',s=>s.delete(id));
 window.dispatchEvent(new CustomEvent(EVENT,{detail:{userId:id}}));
}
export function onAvatarChange(id:number,notify:()=>void):()=>void{
 const handler=(event:Event)=>{if((event as CustomEvent<{userId:number}>).detail?.userId===id)notify();};
 window.addEventListener(EVENT,handler);
 return()=>window.removeEventListener(EVENT,handler);
}

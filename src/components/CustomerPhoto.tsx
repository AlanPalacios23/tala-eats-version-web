import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { safeImage } from '../lib/api';

/** Image URLs belong to the merchant backend. Never replace missing photos
 * with fabricated food photography or display broken HTML image alt labels.
 * A failed resource remains recoverable on the next URL change.
 */
export function CustomerPhoto({src,alt,fallback='🍽️',className='',eager=false}:{
 src?:string|null;alt:string;fallback?:string;className?:string;eager?:boolean;
}){
 const url=safeImage(src);
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[url]);
 return <div className={'customer-image '+className}>
  {url&&!failed?<img src={url} alt={alt} loading={eager?'eager':'lazy'} decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:
   <div className="customer-image-fallback" role="img" aria-label={'Imagen no disponible: '+alt}>
    <span aria-hidden="true">{fallback}</span>
    <ImageOff size={17} strokeWidth={1.8} aria-hidden="true"/>
   </div>}
 </div>;
}

import {useEffect,useState} from 'react';
import {UserRound} from 'lucide-react';
import {safeImage} from '../lib/api';
import {onAvatarChange,readLocalAvatar} from '../lib/customer-avatar';
export function CustomerAvatar({userId,url,size='normal'}:{userId?:number;url?:string|null;size?:'normal'|'large'}){
 const [local,setLocal]=useState<string|null>(null);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  if(!userId||userId<=0){setLocal(null);return;}
  let alive=true,resource:string|null=null;
  const load=()=>{
   void readLocalAvatar(userId).then(blob=>{
    if(!alive)return;
    const next=blob?URL.createObjectURL(blob):null;
    const previous=resource;resource=next;setLocal(next);
    if(previous)URL.revokeObjectURL(previous);
   }).catch(()=>{if(alive)setLocal(null);});
  };
  load();
  const off=onAvatarChange(userId,load);
  return()=>{alive=false;off();if(resource)URL.revokeObjectURL(resource);};
 },[userId]);
 const src=local||safeImage(url);
 useEffect(()=>setFailed(false),[src]);
 return <span className={'customer-avatar-image'+(size==='large'?' customer-avatar-image-large':'')}>
  {src&&!failed?<img src={src} alt="Foto de perfil" onError={()=>setFailed(true)}/>:<UserRound size={size==='large'?44:29}/>}
 </span>;
}

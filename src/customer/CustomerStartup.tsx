import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../lib/session';
import './customer-startup.css';

/** Flutter Usuarios v1.0.46 launch: 5000ms minimum concurrent with session
 * bootstrap, 1050ms centered wordmark entrance and 620ms stage transition.
 * Visual source: mobile/main.dart 1422-1695 @f247bf3.
 */
export function CustomerStartup() {
 const {user,loading}=useSession();
 const location=useLocation();
 const [minimumElapsed,setMinimumElapsed]=useState(false);
 const [exiting,setExiting]=useState(false);
 const [done,setDone]=useState(false);
 const [missingLogo,setMissingLogo]=useState(false);
 useEffect(()=>{
   const t=window.setTimeout(()=>setMinimumElapsed(true),5000);
   return ()=>window.clearTimeout(t);
 },[]);
 useEffect(()=>{
   if(!minimumElapsed||loading)return;
   setExiting(true);
   const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   const t=window.setTimeout(()=>setDone(true),reduced?0:620);
   return ()=>window.clearTimeout(t);
 },[minimumElapsed,loading]);

 if(!done)return <div className={'te-launch te-launch-latest'+(exiting?' te-launch-exit':'')}
  role="status" aria-label="Iniciando Tala Eats">
   <div className="te-launch-latest-center">
     {!missingLogo?<img src="/landing/tala_eats_original_wordmark.png"
        alt="Tala Eats" className="te-launch-latest-wordmark" width="350" height="136"
        onError={()=>setMissingLogo(true)}/>:
       <strong className="te-launch-latest-fallback">Tala Eats</strong>}
   </div>
   <p className="te-launch-latest-subtitle">Pide, disfruta y repite.</p>
 </div>;

 const publicPaths=['/bienvenida','/metodos','/acceso','/recuperar','/restablecer','/terminos','/privacidad'];
 const isPublic=publicPaths.includes(location.pathname);
 if(!user&&!isPublic)return <Navigate to="/bienvenida" replace state={{from:location.pathname}}/>;
 if(user&&['/bienvenida','/metodos','/acceso'].includes(location.pathname)){
  return <Navigate to={user.role==='driver'?'/repartidor':
    (user.role==='restaurant'||user.role==='admin')?'/restaurante':'/clientes'} replace/>;
 }
 return <Outlet/>;
}

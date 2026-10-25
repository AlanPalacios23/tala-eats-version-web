import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../lib/session';
import './customer-startup.css';

/**
 * Port of Flutter TalaEatsApp / LaunchScreen from mobile main.dart.
 * Only mounts for the customer PWA routes; portal /, merchant and driver
 * are unaffected.
 *
 * Flutter: initialization + >=1100ms brand moment in parallel, 420ms
 * FadeTransition into either LoginScreen or CustomerShell.
 */
export function CustomerStartup() {
 const {user,loading}=useSession();
 const location=useLocation();
 const [minimumElapsed,setMinimumElapsed]=useState(false);
 const [exiting,setExiting]=useState(false);
 const [done,setDone]=useState(false);
 useEffect(()=>{
   const timer=window.setTimeout(()=>setMinimumElapsed(true),1100);
   return ()=>window.clearTimeout(timer);
 },[]);
 useEffect(()=>{
   if(!minimumElapsed||loading)return;
   setExiting(true);
   const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   const timer=window.setTimeout(()=>setDone(true),reduced?0:420);
   return ()=>window.clearTimeout(timer);
 },[minimumElapsed,loading]);

 if(!done) return <div className={'te-launch'+(exiting?' te-launch-exit':'')} role="status" aria-label="Iniciando Tala Eats">
   <div className="te-launch-glow" aria-hidden="true"/>
   <div className="te-launch-center">
     <div className="te-launch-logo" aria-hidden="true"><span className="material-icons-round">delivery_dining</span></div>
     <div className="te-launch-copy">
       <strong>Tala Eats</strong>
       <span>Tu comida favorita, más cerca.</span>
     </div>
   </div>
   <div className="te-launch-loader" aria-hidden="true"><span/></div>
 </div>;
 const isPublic=['/acceso','/restablecer','/terminos','/privacidad'].includes(location.pathname);
 if(!user&&!isPublic)return <Navigate to="/acceso" replace state={{from:location.pathname}}/>;
 if(user&&location.pathname==='/acceso')return <Navigate to={user.role==='driver'?'/repartidor':(user.role==='restaurant'||user.role==='admin')?'/restaurante':'/clientes'} replace/>;
 return <Outlet/>;
}

export function CustomerBlockedRole() {
 return <div className="te-customer te-panel-page"><div className="te-panel-inner">
   <h1>Acceso no disponible</h1>
   <p>Esta cuenta pertenece a otra aplicación de Tala Eats.</p>
   <Link to="/" className="te-panel-cta">Volver al portal</Link>
 </div></div>;
}

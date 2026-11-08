import {useState} from 'react';
import type {FormEvent} from 'react';
import {ChefHat,LockKeyhole,LogIn,LogOut,RefreshCw,ShieldCheck,Store,WifiOff} from 'lucide-react';
import {isMerchantRole} from '../lib/api';
import {useSession} from '../lib/session';
import MerchantWorkspace from './MerchantWorkspace';
import CrecePublic from './CrecePublic';
import './merchant-access.css';

function MerchantAccess(){
  const {login}=useSession();
  const [showCrece,setShowCrece]=useState(()=>typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('vista')==='crece');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [otp,setOtp]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(busy)return;
    setBusy(true);setError('');
    try{await login(email.trim(),password,otp.trim()||undefined);}
    catch(e){setError(e instanceof Error?e.message:'No fue posible ingresar. Vuelve a intentarlo.');}
    finally{setBusy(false);}
  };
  if(showCrece)return <CrecePublic onBack={()=>setShowCrece(false)}/>;
  return <main className="merchant-access-shell">
    <div className="merchant-access-brand"><span className="merchant-access-mark"><Store size={23}/></span>
      <strong>Tala <span>Eats</span></strong><small>RESTAURANTES</small>
    </div>
    <section className="merchant-access-card" aria-label="Acceso del restaurante">
      <div className="merchant-access-eyebrow"><ShieldCheck size={15}/> ACCESO SEGURO PARA COMERCIOS</div>
      <h1>Tu negocio, en orden.</h1>
      <p>Inicia sesión para revisar tus pedidos, menú y disponibilidad.</p>
      <form onSubmit={e=>void submit(e)} className="merchant-access-form">
        <label>Correo electrónico<input type="email" name="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="correo@negocio.com" disabled={busy}/></label>
        <label>Contraseña<input type="password" name="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required disabled={busy} placeholder="Tu contraseña"/></label>
        <label>Código de verificación <span>(si está activado)</span><input inputMode="numeric" name="one-time-code" autoComplete="one-time-code" value={otp} onChange={e=>setOtp(e.target.value)} disabled={busy} placeholder="Código de seguridad"/></label>
        {error&&<p role="alert" className="merchant-access-error"><WifiOff size={16}/>{error}</p>}
        <button type="submit" disabled={busy} className="merchant-access-submit">{busy?<RefreshCw size={19} className="merchant-spin"/>:<LogIn size={19}/>} {busy?'Verificando acceso…':'Entrar a mi negocio'}</button>
      </form>
      <p className="merchant-access-security"><LockKeyhole size={15}/> Solo cuentas autorizadas de restaurante y administración.</p>
      <button type="button" className="merchant-crece-discover" onClick={()=>setShowCrece(true)}>Conoce Tala Eats Crece y los beneficios para tu negocio</button>
    </section>
    <footer className="merchant-access-footer"><ChefHat size={16}/> Tala Eats · Administración de comercios</footer>
  </main>;
}

export default function MerchantStandalone(){
  const {user,loading,logout}=useSession();
  const [leaving,setLeaving]=useState(false);
  if(loading)return <main className="merchant-access-loading" role="status"><RefreshCw className="merchant-spin" size={20}/> Verificando tu sesión…</main>;
  if(!user)return <MerchantAccess/>;
  if(!isMerchantRole(user.role))return <main className="merchant-access-shell">
    <div className="merchant-access-brand"><span className="merchant-access-mark"><Store size={22}/></span><strong>Tala <span>Eats</span></strong></div>
    <section className="merchant-access-card"><div className="merchant-access-eyebrow"><ShieldCheck size={15}/> ACCESO PROTEGIDO</div>
      <h1>Esta cuenta no es de restaurante</h1>
      <p>Necesitas un perfil de comercio autorizado para administrar pedidos. No se mostrarán datos del restaurante.</p>
      <button type="button" className="merchant-access-submit" disabled={leaving} onClick={()=>{setLeaving(true);void logout().catch(()=>{}).finally(()=>setLeaving(false));}}><LogOut size={19}/> Cambiar de cuenta</button>
    </section>
  </main>;
  return <MerchantWorkspace/>;
}

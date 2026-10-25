import {useEffect,useState} from 'react';import type {FormEvent} from 'react';
import {ArrowLeft,Check,RefreshCw,UserRound} from 'lucide-react';import {Link} from 'react-router-dom';import {useSession} from '../lib/session';import {api,safeImage} from '../lib/api';
export function CustomerProfile(){
 const {user,refresh}=useSession();const [name,setName]=useState(user?.name??''),[phone,setPhone]=useState(user?.phone??'');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 useEffect(()=>{setName(user?.name??'');setPhone(user?.phone??'');setSaved(false);},[user?.id,user?.name,user?.phone]);
 async function submit(e:FormEvent){
  e.preventDefault();if(busy)return;
  setBusy(true);setError('');setSaved(false);
  try{
   const cleanName=name.trim(),cleanPhone=phone.trim();
   if(cleanName.length<2||cleanName.length>100)throw new Error('Tu nombre debe tener entre 2 y 100 caracteres.');
   if(cleanPhone&&!/^[0-9+() -]{7,20}$/.test(cleanPhone))throw new Error('Introduce un teléfono válido.');
   const updated=await api.updateProfile(cleanName,cleanPhone);
   if(updated.id!==user?.id||updated.name!==cleanName)throw new Error('El servidor no confirmó la actualización del perfil.');
   await refresh();setSaved(true);
  }catch(err){setError(err instanceof Error?err.message:'No pudimos actualizar el perfil.');}
  finally{setBusy(false);}
 }
 return <div className="mobile-customer-page mobile-profile" data-mobile-screen="profile">
  <div className="mobile-detail-header"><Link to="/cuenta" aria-label="Regresar a Cuenta"><ArrowLeft size={22}/></Link><h1>Editar perfil</h1></div>
  <section className="mobile-profile-card">
   <div className="mobile-profile-avatar">{safeImage(user?.avatar_url)?<img src={safeImage(user?.avatar_url)!} alt="Foto de perfil"/>:<UserRound size={38}/>}</div>
   <p>Foto de perfil</p><small>La carga de fotografías desde navegador estará disponible cuando el backend confirme un método compatible.</small>
  </section>
  <form className="mobile-profile-form" onSubmit={e=>void submit(e)}>
   <label>Nombre completo<input required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={e=>{setName(e.target.value);setSaved(false);}}/></label>
   <label>Correo electrónico<input readOnly value={user?.email??''} autoComplete="email" aria-label="Correo electrónico, solo lectura"/></label>
   <label>Teléfono<input maxLength={20} inputMode="tel" autoComplete="tel" value={phone} onChange={e=>{setPhone(e.target.value);setSaved(false);}}/></label>
   {error&&<div className="mobile-address-error" role="alert">{error}</div>}
   {saved&&<div className="mobile-profile-saved" role="status"><Check size={17}/> Perfil actualizado y confirmado.</div>}
   <button type="submit" className="mobile-checkout-fixed" disabled={busy||!user}>{busy?<><RefreshCw size={18} className="spin"/> Guardando…</>:'Guardar cambios'}</button>
  </form>
 </div>;
}

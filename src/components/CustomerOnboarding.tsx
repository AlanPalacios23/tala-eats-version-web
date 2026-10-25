import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Mail } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../lib/session';
import {LEGAL_LINKS} from '../lib/legal-links';

type AuthMode='signin'|'signup';
const AUTH_EMAIL=/^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function safeDestination(value:unknown):string{
 return typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//')&&!value.startsWith('/acceso')?value:'/clientes';
}
/** Matches Flutter 1.0.46 first-party path. Mobile food photos are NOT in
 * its tracked assets; preserve a neutral gradient rather than fake originals.
 */
export function CustomerEntry(){
 const {user}=useSession(),navigate=useNavigate(),location=useLocation();
 const [stage,setStage]=useState<'splash'|'welcome'|'methods'>('splash');
 const [splashArtFailed,setSplashArtFailed]=useState(false);
 const from=safeDestination((location.state as {from?:string}|null)?.from);
 useEffect(()=>{
  if(user?.role==='customer')navigate(from,{replace:true});
 },[user?.role,navigate,from]);
 if(user?.role==='customer')return null;
 return <div className={'customer-entry-screen stage-'+stage} data-mobile-screen={stage} aria-label="Bienvenida a Tala Eats">
  {stage==='splash'?<div className="customer-onboarding-splash customer-splash-exact">
    <picture className="customer-splash-art" aria-hidden="true" style={{display:splashArtFailed?'none':undefined}}>
      <source srcSet="/branding/splash-exacto-728x1536.webp" type="image/webp"/>
      <img src="/branding/splash-exacto-728x1536.webp" width="728" height="1536" alt="" draggable={false} onError={()=>setSplashArtFailed(true)}/>
    </picture>
    <div className="customer-splash-fallback" aria-hidden="true"><img src="/branding/tala-script-gradient.svg" alt="" width="340" height="104"/><span>COMERCIO LOCAL</span><p>Pide, disfruta y repite.</p></div>
    <button type="button" className="customer-splash-next" onClick={()=>setStage('welcome')} aria-label="Siguiente pantalla" title="Siguiente"><ArrowRight size={28} strokeWidth={2.4}/></button>
  </div>:
   stage==='welcome'?<div className="customer-onboarding-photo welcome">
     <div className="customer-onboarding-content"><div className="customer-brand-plaque"><img className="customer-brand-script" src="/branding/tala-script-gradient.svg" alt="Tala Eats" width="290" height="88"/></div><h1>Bienvenido<br/>a Tala Eats</h1><p>Tus platillos favoritos,<br/>más cerca de ti.</p></div>
     <button className="customer-onboarding-cta glass" onClick={()=>setStage('methods')}><span className="customer-cta-label">Continuar</span><ArrowRight size={22} aria-hidden="true"/></button>
    </div>:
    <div className="customer-onboarding-photo methods">
     <button className="customer-onboarding-back" aria-label="Volver a bienvenida" onClick={()=>setStage('welcome')}><ArrowLeft size={26}/></button>
     <div className="customer-onboarding-content"><div className="customer-brand-plaque subtle"><img className="customer-brand-script" src="/branding/tala-script-gradient.svg" alt="Tala Eats" width="240" height="73"/></div><h1>Un antojo,<br/>mil posibilidades.</h1><p>Disfruta lo mejor de los comercios de tu ciudad.</p></div>
     <div className="customer-onboarding-actions"><Link className="customer-onboarding-cta orange" to="/acceso" state={{from}}><Mail size={23} aria-hidden="true"/><span className="customer-cta-label">Continuar con tu correo</span><ArrowRight size={20} aria-hidden="true"/></Link><Link to="/acceso" state={{from,create:true}} className="customer-onboarding-register">¿Aún no tienes cuenta? <strong>Crear cuenta</strong></Link></div>
    </div>}
 </div>;
}
export function CustomerStepAuth(){
 const {user,login,register}=useSession(),nav=useNavigate(),loc=useLocation();
 const initial=(loc.state as {create?:boolean;from?:string}|null);
 const [mode,setMode]=useState<AuthMode>(initial?.create?'signup':'signin');
 const [step,setStep]=useState(0);
 const [first,setFirst]=useState(''),[last,setLast]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[visible,setVisible]=useState(false),[consent,setConsent]=useState(false);
 const total=mode==='signin'?2:4,final=total-1;
 const from=safeDestination(initial?.from);
 const value=mode==='signin'?(step===0?email:password):[first,last,email,password][step];
 const isPassword=step===final;
 const isEmail=mode==='signin'?step===0:step===2;
 const valid=isPassword?(mode==='signin'?password.length>0:password.length>=8&&/[A-Z]/.test(password)&&/[a-z]/.test(password)&&/[0-9]/.test(password)):
   isEmail?AUTH_EMAIL.test(email.trim())&&email.length<=254:value.trim().length>=2&&value.trim().length<=80;
 const heading=mode==='signin'?step===0?'Ingresa tu correo\npara iniciar sesión':'Ingresa tu contraseña\npara iniciar sesión':
  ['¡Hola!\n¿Cuál es tu nombre?','¿Cuál es tu apellido?','Por último, agrega tu\ncorreo electrónico','Crea tu contraseña\nde TALA EATS'][step];
 const change=(next:string)=>{
  setError('');
  if(mode==='signin'){if(step===0)setEmail(next);else setPassword(next);}
  else if(step===0)setFirst(next);else if(step===1)setLast(next);else if(step===2)setEmail(next);else setPassword(next);
 };
 const switchMode=()=>{if(busy)return;setMode(m=>m==='signin'?'signup':'signin');setStep(0);setError('');setConsent(false)};
 const back=()=>{if(busy)return;if(step>0){setStep(s=>s-1);setError('');}else nav('/iniciar',{replace:false,state:{from}})};
 const next=async(e:FormEvent)=>{
  e.preventDefault();if(busy||!valid)return;
  if(step<final){setStep(s=>s+1);setError('');return;}
  if(mode==='signup'&&!consent){setError('Confirma la aceptación de los términos y del aviso de privacidad antes de continuar.');return;}
  setBusy(true);setError('');
  try{
   if(mode==='signin')await login(email.trim(),password);
   else await register((first.trim()+' '+last.trim()).trim(),email.trim(),password);
   nav(from,{replace:true});
  }catch(e){setError(e instanceof Error?e.message:'No pudimos verificar tu cuenta.');}
  finally{setBusy(false);}
 };
 useEffect(()=>{if(user?.role==='customer')nav(from,{replace:true});},[user?.role,nav,from]);
 if(user?.role==='customer')return null;
 return <div className="customer-step-auth" data-mobile-screen="step-auth">
   <button className="customer-auth-back" onClick={back} aria-label="Regresar" disabled={busy}><ArrowLeft size={29}/></button>
   <div className="customer-auth-progress">
    <span>{mode==='signin'?'INICIAR SESIÓN':'CREAR CUENTA'} · PASO {step+1} DE {total}</span>
    <div><span style={{width:((step+1)/total*100)+'%'}}/></div>
   </div>
   <form onSubmit={e=>void next(e)} className="customer-auth-form">
    <h1>{heading}</h1>
    <label className="customer-auth-large-input">
     <span className="customer-auth-field-caption">{isEmail?'Correo electrónico':isPassword?'Contraseña':step===0?'Nombre':'Apellido'}</span>
     <input key={mode+step} type={isPassword&&!visible?'password':isEmail?'email':'text'}
       aria-label={isEmail?'Correo electrónico':isPassword?'Contraseña':step===0?'Nombre':'Apellido'}
       autoComplete={isEmail?'email':isPassword?mode==='signin'?'current-password':'new-password':step===0?'given-name':'family-name'}
       autoFocus value={value} onChange={e=>change(e.target.value)}
       maxLength={isEmail?254:isPassword?256:80}
       placeholder={isEmail?'Tu correo':isPassword?'Tu contraseña':step===0?'Tu nombre':'Tu apellido'} required/>
     {isPassword&&<button type="button" onClick={()=>setVisible(x=>!x)} aria-label={visible?'Ocultar contraseña':'Mostrar contraseña'}>{visible?<EyeOff size={21}/>:<Eye size={21}/>}</button>}
    </label>
    {isPassword&&mode==='signup'&&<p className="customer-auth-hint">Mínimo 8 caracteres, mayúscula, minúscula y número. Usa una contraseña nueva de TALA EATS.</p>}
    {isPassword&&mode==='signup'&&<label className="customer-auth-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> He leído y acepto los <a href={LEGAL_LINKS.terms} target="_blank" rel="noopener noreferrer">Términos y condiciones</a> y el <a href={LEGAL_LINKS.privacy} target="_blank" rel="noopener noreferrer">Aviso de privacidad</a> de Tala Eats.</label>}
    {error&&<div className="customer-auth-error" role="alert">{error}</div>}
    {step===0&&<button type="button" className="customer-auth-switch" onClick={switchMode}>{mode==='signin'?'¿Aún no tienes cuenta? Crear cuenta en TALA EATS':'¿Ya tienes cuenta? Iniciar sesión'}</button>}
    <button className="customer-auth-next" type="submit" disabled={!valid||busy||(mode==='signup'&&isPassword&&!consent)}><span className="customer-cta-label">{busy?'Verificando…':isPassword?mode==='signin'?'Iniciar sesión':'Crear cuenta':'Continuar'}</span><ArrowRight size={21} aria-hidden="true"/></button>
   </form>
 </div>;
}

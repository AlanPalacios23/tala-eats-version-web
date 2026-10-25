import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, ChevronRight, CloudOff, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../lib/session';
import './customer-step-auth.css';

type Mode='signIn'|'signUp';
const signupTitles=['¡Hola!\n¿Cuál es tu nombre?','¿Cuál es tu apellido?',
  'Por último, agrega tu\ncorreo electrónico','Crea tu contraseña\nde TALA EATS'];
const signupHints=['Tu nombre','Tu apellido','Tu correo','Tu contraseña'];
const emailValid=(s:string)=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim())&&s.trim().length<=254;
const strong=(s:string)=>s.length>=8&&/[A-Z]/.test(s)&&/[a-z]/.test(s)&&/[0-9]/.test(s);

/** Faithful port of ui/step_auth_screens.dart @ Mobile v1.0.46,
 * including 2-step sign in / 4-step sign up and separate consent booleans.
 * No credential storage, no speculative OTP/social login.
 */
export function CustomerStepAuth(){
 const session=useSession(),navigate=useNavigate(),location=useLocation();
 const [mode,setMode]=useState<Mode>((location.state as {create?:boolean}|null)?.create?'signUp':'signIn');
 const [step,setStep]=useState(0);
 const [first,setFirst]=useState(''),[last,setLast]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [consentOpen,setConsentOpen]=useState(false),[terms,setTerms]=useState(false),[privacy,setPrivacy]=useState(false);
 const input=useRef<HTMLInputElement>(null);
 const signUp=mode==='signUp',maxStep=signUp?3:1,isPassword=step===maxStep;
 const value=signUp?[first,last,email,password][step]:step===0?email:password;
 const valid=signUp&&step<2?value.trim().length>=2&&value.trim().length<=80:
   !isPassword?emailValid(value):signUp?strong(password):password.length>0;
 const heading=signUp?signupTitles[step]:(step===0?'Ingresa tu correo\npara iniciar sesión':'Ingresa tu contraseña\npara iniciar sesión');
 const hint=signUp?signupHints[step]:(step===0?'Tu correo':'Tu contraseña');
 const onChange=(v:string)=>{
  setError('');
  if(signUp){if(step===0)setFirst(v);else if(step===1)setLast(v);else if(step===2)setEmail(v);else setPassword(v);}
  else if(step===0)setEmail(v);else setPassword(v);
 };
 const switchMode=(m:Mode)=>{
  if(busy)return;setMode(m);setStep(0);setError('');setVisible(false);
 };
 const back=()=>{
  if(busy)return;
  if(consentOpen){setConsentOpen(false);return;}
  if(step===0){navigate('/metodos');return;}
  setError('');setStep(s=>s-1);
 };
 const from=(location.state as {from?:string}|null)?.from;
 const nextDestination=from?.startsWith('/')&&!from.startsWith('//')&&!['/bienvenida','/metodos','/acceso'].includes(from)?from:'/clientes';
 async function login(){
  if(busy)return;setBusy(true);setError('');
  try {
   const user=await session.login(email.trim(),password);
   const dest=user.role==='driver'?'/repartidor':
     (user.role==='restaurant'||user.role==='admin')?'/restaurante':nextDestination;
   navigate(dest,{replace:true});
  }catch(e){setError(e instanceof Error?e.message:'Comprueba tu correo y contraseña.');}
  finally {setBusy(false);}
 }
 async function register(){
  if(busy||!terms||!privacy)return;
  setBusy(true);setError('');
  try {
   await session.register(first.trim()+' '+last.trim(),email.trim(),password);
   setConsentOpen(false);
   navigate('/clientes',{replace:true});
  }catch(e){setConsentOpen(false);setError(e instanceof Error?e.message:'No pudimos crear la cuenta.');}
  finally{setBusy(false);}
 }
 function advance(event?:FormEvent){
  event?.preventDefault();
  if(busy||consentOpen||!valid)return;
  if(step<maxStep){setStep(s=>s+1);setError('');setVisible(false);return;}
  if(signUp){setTerms(false);setPrivacy(false);setConsentOpen(true);return;}
  void login();
 }
 useEffect(()=>{input.current?.focus();},[step,mode]);
 useEffect(()=>{
  if(!consentOpen)return;
  const listener=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy)setConsentOpen(false);};
  window.addEventListener('keydown',listener);return ()=>window.removeEventListener('keydown',listener);
 },[consentOpen,busy]);
 return <div className="te-step-auth te-motion-page">
  <form className="te-step-form" onSubmit={advance}>
   <div className="te-step-backline">
     <button type="button" aria-label="Regresar" onClick={back}><ArrowLeft size={31}/></button>
   </div>
   <div className="te-step-indicator">
     <span>{signUp?'CREAR CUENTA':'INICIAR SESIÓN'} · PASO {step+1} DE {maxStep+1}</span>
     <div className="te-step-progress" role="progressbar" aria-label="Progreso" aria-valuemin={0}
       aria-valuemax={maxStep+1} aria-valuenow={step+1}>
       <span style={{width:(step+1)/(maxStep+1)*100+'%'}}/>
     </div>
   </div>
   <div className="te-step-main" key={mode+'-'+step}>
     <h1>{heading}</h1>
     <div className="te-step-field">
       <input ref={input} type={isPassword&&!visible?'password':!isPassword&&(
         (signUp&&step===2)||(!signUp&&step===0))?'email':'text'}
         placeholder={hint} aria-label={hint} value={value} onChange={e=>onChange(e.target.value)}
         autoComplete={isPassword?(signUp?'new-password':'current-password'):
            (signUp&&step===0)?'given-name':(signUp&&step===1)?'family-name':'email'}
         minLength={isPassword?(signUp?8:1):undefined}
         maxLength={!isPassword&&(signUp&&step<2)?80:!isPassword?254:undefined}
         spellCheck={!isPassword&&signUp&&step<2}
       />
       {isPassword&&<button className="te-step-visibility" aria-label={visible?'Ocultar contraseña':'Mostrar contraseña'}
        type="button" onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={25}/>:<Eye size={25}/>}</button>}
     </div>
     {signUp&&isPassword&&<p className="te-step-hint">Mínimo 8 caracteres, mayúscula, minúscula y número. Usa una contraseña nueva de TALA EATS, no la de Google.</p>}
     {error&&<div className="te-step-error" role="alert"><CloudOff size={21}/><div>{error}
       {isPassword&&!signUp&&<button type="button" onClick={()=>void login()} disabled={!valid||busy}><RefreshCw size={17}/> Volver a intentar</button>}
       </div></div>}
     {step===0&&<button type="button" className="te-step-switch" onClick={()=>switchMode(signUp?'signIn':'signUp')}>
        {signUp?'¿Ya tienes cuenta? Iniciar sesión':'¿Aún no tienes cuenta? Crear cuenta en TALA EATS'}
      </button>}
     {isPassword&&!signUp&&<Link className="te-step-forgot" to="/recuperar">¿Olvidaste tu contraseña?</Link>}
   </div>
   <div className="te-step-bottom">
     {busy?<div className="te-step-busy" role="status"><span/>Validando…</div>:
      <button type="submit" className="te-step-next" aria-label="Continuar" disabled={!valid}>
       <ChevronRight size={23}/>
      </button>}
   </div>
  </form>
  {consentOpen&&<div className="te-step-modal-backdrop">
    <section role="dialog" aria-modal="true" aria-labelledby="te-consent-title" className="te-step-modal">
      <div className="te-step-drag" aria-hidden="true"/>
      <h2 id="te-consent-title">Términos y condiciones</h2>
      <div className="te-step-rule"/>
      <label><input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)}/>
       <span>Acepto los Términos y Condiciones de TALA EATS.
         <Link to="/terminos" target="_blank" rel="noopener noreferrer">Leer términos</Link></span></label>
      <label><input type="checkbox" checked={privacy} onChange={e=>setPrivacy(e.target.checked)}/>
       <span>Acepto el Aviso de Privacidad.
         <Link to="/privacidad" target="_blank" rel="noopener noreferrer">Leer aviso de privacidad</Link></span></label>
      <button className="te-step-accept" type="button" disabled={!terms||!privacy||busy}
        onClick={()=>void register()}>{busy?'Validando…':'Aceptar'}</button>
      <button className="te-step-cancel" type="button" disabled={busy} onClick={()=>setConsentOpen(false)}>Regresar</button>
    </section>
   </div>}
 </div>;
}

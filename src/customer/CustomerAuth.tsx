import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, AtSign, Check, ChefHat, Circle, Eye, EyeOff, Info, LockKeyhole, MailCheck, ShieldCheck, UserRound } from 'lucide-react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import './customer-auth.css';

/** Faithful Flutter PremiumAuthScaffold: Login, SignUp, VerifyAccount,
 * ForgotPassword, ResetPassword and PasswordUpdatedScreen.
 * Mobile uses no intermediary promotional/onboarding screen.
 * Server remains the authority on authentication and verification.
 */
type Stage='login'|'signup'|'confirm'|'forgot'|'sent'|'reset'|'updated';
type Icon = typeof AtSign;
function AuthInput({label,value,onChange,Icon,placeholder,type='text',autoComplete,showToggle,onToggle,required=true}:{
 label:string;value:string;onChange:(value:string)=>void;Icon:Icon;placeholder?:string;
 type?:string;autoComplete?:string;showToggle?:boolean;onToggle?:()=>void;required?:boolean;
}) {
 return <label className="te-auth-field">{label}
  <span className="te-auth-input">
   <Icon size={19} aria-hidden="true"/>
   <input value={value} type={type} onChange={event=>onChange(event.target.value)}
    placeholder={placeholder} autoComplete={autoComplete} required={required} aria-label={label}/>
   {onToggle&&<button className="te-auth-toggle" type="button" onClick={onToggle}
     aria-label={showToggle?'Ocultar contraseña':'Mostrar contraseña'}>
     {showToggle?<EyeOff size={19}/>:<Eye size={19}/>}
   </button>}
  </span>
 </label>;
}
const checks=(value:string)=>[
 ['8+ caracteres',value.length>=8],['Mayúscula',/[A-Z]/.test(value)],
 ['Minúscula',/[a-z]/.test(value)],['Número',/[0-9]/.test(value)],
] as const;
function PasswordRules({password}:{password:string}){
 const list=checks(password),score=list.filter(([,valid])=>valid).length;
 return <div className="te-auth-password-rules">
  <div className="te-auth-rules-heading"><span>Seguridad de la contraseña</span>
   <strong>{score===0?'Requisitos':score<=1?'Débil':score<=3?'Casi lista':'Segura'}</strong></div>
  <div className="te-auth-strength" aria-label={score+' de 4 requisitos cumplidos'}>
   {list.map(([label],index)=><span key={label} className={index<score?'complete':''}/>)}
  </div>
  <div className="te-auth-rules-list">{list.map(([label,valid])=>
    <span className={valid?'complete':''} key={label}>{valid?<Check size={13}/>:<Circle size={12}/>} {label}</span>
  )}</div>
 </div>;
}
function AuthScaffold({title,subtitle,children,showBack,onBack}:{
 title:string;subtitle:string;children:ReactNode;showBack?:boolean;onBack:()=>void;
}){
 return <div className="te-customer-auth te-motion-page">
   <div className="te-auth-glow" aria-hidden="true"/>
   <div className="te-auth-content">
    <div className="te-auth-brand">
     {showBack?<button type="button" className="te-auth-circle-back" onClick={onBack} aria-label="Regresar"><ArrowLeft size={21}/></button>:
      <><span className="te-auth-logo"><span className="material-icons-round">delivery_dining</span></span><strong>Tala Eats</strong></>}
    </div>
    <div className="te-auth-heading te-motion-reveal"><h1>{title}</h1><p>{subtitle}</p></div>
    <div className="te-auth-body te-motion-reveal">{children}</div>
   </div>
 </div>;
}
function InfoNote({children}:{children:ReactNode}){
 return <div className="te-auth-note"><Info size={17}/><span>{children}</span></div>;
}
function SuccessOrb({icon}:{icon:ReactNode}){
 return <div className="te-auth-success-orb" aria-hidden="true"><span>{icon}</span></div>;
}
export function CustomerAuth() {
 const session=useSession(),navigate=useNavigate(),location=useLocation();
 const resetToken=new URLSearchParams(location.search).get('token')?.trim()||'';
 const [stage,setStage]=useState<Stage>(location.pathname==='/restablecer'?'reset':
     (location.state as {create?:boolean}|null)?.create?'signup':'login');
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [confirm,setConfirm]=useState(''),[otp,setOtp]=useState('');
 const [showPassword,setShowPassword]=useState(false),[showConfirm,setShowConfirm]=useState(false);
 const [accepted,setAccepted]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const from=(location.state as {from?:string}|null)?.from;
 const afterLogin=from?.startsWith('/')&&!from.startsWith('//')&&!['/restaurante','/repartidor','/acceso'].includes(from)?from:'/clientes';
 const switchStage=(next:Stage)=>{if(busy)return;setError('');setStage(next);};
 async function doLogin(event:FormEvent) {
  event.preventDefault();if(busy)return;setBusy(true);setError('');
  try{await session.login(email.trim(),password,otp);navigate(afterLogin,{replace:true});}
  catch(e){setError(e instanceof Error?e.message:'Revisa tu correo y contraseña e inténtalo de nuevo.');}
  finally{setBusy(false);}
 }
 function validateSignup(event:FormEvent) {
  event.preventDefault();
  if(name.trim().length<2){setError('Escribe tu nombre.');return;}
  if(!email.trim().includes('@')){setError('Escribe un correo válido.');return;}
  if(!checks(password).every(([,ok])=>ok)){setError('Tu contraseña todavía no cumple los requisitos.');return;}
  if(password!==confirm){setError('Las contraseñas no coinciden.');return;}
  if(!accepted){setError('Acepta los términos y el aviso de privacidad.');return;}
  switchStage('confirm');
 }
 async function createAccount() {
  if(busy)return;setBusy(true);setError('');
  try{await session.register(name.trim(),email.trim(),password);navigate('/clientes',{replace:true});}
  catch(e){setError(e instanceof Error?e.message:'No pudimos crear la cuenta.');}
  finally{setBusy(false);}
 }
 async function forgot(event:FormEvent) {
  event.preventDefault();if(busy)return;setBusy(true);setError('');
  try{await api.forgotPassword(email.trim());setStage('sent');}
  catch(e){setError(e instanceof Error?e.message:'No pudimos enviar la solicitud.');}
  finally{setBusy(false);}
 }
 async function resetPassword(event:FormEvent) {
  event.preventDefault();if(busy)return;
  if(!resetToken){setError('El enlace de recuperación no contiene un código válido.');return;}
  if(!checks(password).every(([,ok])=>ok)){setError('La nueva contraseña todavía no cumple los requisitos.');return;}
  if(password!==confirm){setError('Las contraseñas no coinciden.');return;}
  setBusy(true);setError('');
  try{await api.resetPassword(resetToken,password);setStage('updated');}
  catch(e){setError(e instanceof Error?e.message:'No pudimos actualizar la contraseña.');}
  finally{setBusy(false);}
 }
 const errorBox=error&&<div className="te-auth-error" role="alert">{error}</div>;
 if(session.user)return <Navigate to="/clientes" replace/>;
 if(stage==='confirm')return <AuthScaffold title="Confirma tus datos"
  subtitle="Revisa que tu correo sea correcto. Lo usarás para entrar y recuperar tu cuenta."
  showBack onBack={()=>switchStage('signup')}>
   <div className="te-auth-confirm-card">
     <span><UserRound size={23}/></span><div><strong>{name.trim()}</strong><small>{email.trim()}</small></div>
   </div>
   {errorBox}
   <button className="te-auth-submit" onClick={()=>void createAccount()} disabled={busy}>
     {busy?'Creando cuenta…':'Crear cuenta y entrar'}<ArrowRight size={19}/></button>
   <button className="te-auth-secondary" onClick={()=>switchStage('signup')} disabled={busy}>Editar datos</button>
  </AuthScaffold>;
 if(stage==='forgot'||stage==='sent')return <AuthScaffold showBack onBack={()=>switchStage('login')}
  title={stage==='sent'?'Revisa tu correo':'Recupera tu contraseña'}
  subtitle={stage==='sent'?'Si la cuenta existe, recibirás un enlace seguro. Ábrelo para crear tu nueva contraseña.':'Te enviaremos un enlace seguro para crear una nueva contraseña.'}>
    {stage==='sent'?<div className="te-auth-sent"><SuccessOrb icon={<MailCheck size={42}/>}/>
       <InfoNote>Si no lo ves en unos minutos, revisa las carpetas de spam o promociones.</InfoNote>
       <button className="te-auth-secondary outlined" onClick={()=>switchStage('login')}>Volver al inicio de sesión</button>
      </div>:
     <form className="te-auth-form" onSubmit={event=>void forgot(event)}>
       <AuthInput Icon={AtSign} label="Correo electrónico" type="email" autoComplete="email"
        placeholder="correo@ejemplo.com" value={email} onChange={setEmail}/>
       {errorBox}<button className="te-auth-submit" disabled={busy}>{busy?'Enviando…':'Enviar enlace'}</button>
     </form>}
  </AuthScaffold>;
 if(stage==='reset'||stage==='updated')return <AuthScaffold title={stage==='updated'?'Contraseña actualizada':'Crea una nueva contraseña'}
  subtitle={stage==='updated'?'Ya puedes iniciar sesión con tu nueva contraseña.':'Elige una contraseña segura que no uses en otros servicios.'}
  onBack={()=>navigate('/acceso',{replace:true})}>
   {stage==='updated'?<div className="te-auth-sent"><SuccessOrb icon={<LockKeyhole size={42}/>}/>
     <button type="button" className="te-auth-submit" onClick={()=>navigate('/acceso',{replace:true})}>Volver a iniciar sesión</button>
    </div>:
   <form className="te-auth-form" onSubmit={event=>void resetPassword(event)}>
     <AuthInput Icon={LockKeyhole} label="Nueva contraseña" type={showPassword?'text':'password'} autoComplete="new-password"
       value={password} onChange={setPassword} onToggle={()=>setShowPassword(v=>!v)} showToggle={showPassword}/>
     <PasswordRules password={password}/>
     <AuthInput Icon={ShieldCheck} label="Confirma la nueva contraseña" type={showConfirm?'text':'password'}
       value={confirm} onChange={setConfirm} onToggle={()=>setShowConfirm(v=>!v)} showToggle={showConfirm}/>
     {errorBox}<button className="te-auth-submit" disabled={busy}>{busy?'Actualizando…':'Actualizar contraseña'}</button>
   </form>}
  </AuthScaffold>;
 if(stage==='signup')return <AuthScaffold title="Crea tu cuenta"
    subtitle="Un minuto y quedas listo para pedir en Tala Eats."
    showBack onBack={()=>switchStage('login')}>
    <form className="te-auth-form" onSubmit={validateSignup}>
      <AuthInput Icon={UserRound} label="Nombre" autoComplete="name" value={name} onChange={setName} placeholder="Tu nombre"/>
      <AuthInput Icon={AtSign} label="Correo electrónico" type="email" autoComplete="email" value={email} onChange={setEmail} placeholder="correo@ejemplo.com"/>
      <AuthInput Icon={LockKeyhole} label="Crea una contraseña" type={showPassword?'text':'password'}
       autoComplete="new-password" value={password} onChange={setPassword} onToggle={()=>setShowPassword(v=>!v)} showToggle={showPassword}/>
      <PasswordRules password={password}/>
      <AuthInput Icon={ShieldCheck} label="Confirma tu contraseña" type={showConfirm?'text':'password'}
       autoComplete="new-password" value={confirm} onChange={setConfirm} onToggle={()=>setShowConfirm(v=>!v)} showToggle={showConfirm}/>
      <label className="te-auth-accept"><input type="checkbox" checked={accepted} onChange={event=>setAccepted(event.target.checked)}/>
        <span>Acepto los Términos y el Aviso de privacidad.</span></label>
      <div className="te-auth-legal-links">
       <Link to="/terminos" target="_blank" rel="noopener noreferrer">Leer términos</Link>
       <Link to="/privacidad" target="_blank" rel="noopener noreferrer">Leer aviso de privacidad</Link>
      </div>
      {errorBox}
      <button className="te-auth-submit">Continuar<ArrowRight size={19}/></button>
      <InfoNote>Nunca compartas tu contraseña. Tala Eats no te la pedirá por mensaje.</InfoNote>
    </form>
   </AuthScaffold>;
 return <AuthScaffold title="Bienvenido de vuelta"
   subtitle="Pide lo que se te antoje y sigue tu pedido en tiempo real."
   onBack={()=>navigate('/clientes')}>
   <form className="te-auth-form" onSubmit={event=>void doLogin(event)}>
     <AuthInput Icon={AtSign} label="Correo electrónico" type="email" autoComplete="email" value={email} onChange={setEmail} placeholder="correo@ejemplo.com"/>
     <AuthInput Icon={LockKeyhole} label="Contraseña" type={showPassword?'text':'password'}
      autoComplete="current-password" value={password} onChange={setPassword} onToggle={()=>setShowPassword(v=>!v)} showToggle={showPassword}/>
     <button type="button" className="te-auth-forgot" onClick={()=>switchStage('forgot')}>¿Olvidaste tu contraseña?</button>
     <div className="te-auth-optional-otp">
      <label htmlFor="te-login-otp">Código de autenticación (solo si tienes 2FA)</label>
      <input id="te-login-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={12} value={otp} onChange={event=>setOtp(event.target.value)} placeholder="Código de 6 dígitos"/>
     </div>
     {errorBox}<button className="te-auth-submit" disabled={busy}>{busy?'Iniciando sesión…':'Iniciar sesión'}<ArrowRight size={19}/></button>
   </form>
   <p className="te-auth-switch">¿Aún no tienes cuenta? <button type="button" onClick={()=>switchStage('signup')}>Crear cuenta</button></p>
   <p className="te-auth-fineprint">Al iniciar sesión aceptas los Términos y Condiciones de Uso y reconoces el Aviso de Privacidad de Tala Eats. Precios, disponibilidad y cargos se confirman antes de finalizar cada pedido.</p>
   <div className="te-auth-legal-links centered"><Link to="/terminos" target="_blank" rel="noopener noreferrer">Términos y Condiciones</Link>
     <Link to="/privacidad" target="_blank" rel="noopener noreferrer">Aviso de Privacidad</Link></div>
  </AuthScaffold>;
}

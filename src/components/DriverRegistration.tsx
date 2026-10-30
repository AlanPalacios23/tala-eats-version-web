import {useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {Link,Navigate,useNavigate} from 'react-router-dom';
import {ArrowLeft,CheckCircle2,FileCheck2,ShieldCheck,Smartphone,UploadCloud,UserRound,WifiOff} from 'lucide-react';
import {api,ApiError} from '../lib/api';
import {useSession} from '../lib/session';
import {driverPlateIsValid,normalizeDriverPlate} from '../lib/driver-registration';
import {onboardingSelectionError,prepareOnboardingDocuments,readableOnboardingSize} from '../lib/onboarding-documents';
import type {DriverVehicle} from '../lib/driver-registration';
import '../styles/driver-flutter.css';
import {DriverPwaInstallButton} from './DriverPwaInstall';

const messageOf=(error:unknown)=>error instanceof Error?error.message:'No pudimos completar la operación. Revisa tu conexión.';
/** Minimal text-only mark used during initial loading, never in forms. */
export function DriverBrand(){return <Link to="/" className="df-brand df-brand-plain" aria-label="Tala Eats, inicio">Tala Eats</Link>;}

export function DriverAccess(){
 const session=useSession();
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [otp,setOtp]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [application,setApplication]=useState<{status:string;notes?:string}|null>(null);
 const [queryError,setQueryError]=useState(false);
 const navigate=useNavigate();
 useEffect(()=>{
  if(session.user?.role!=='customer')return;
  let alive=true;
  void api.driverOnboardingMine().then(rows=>{
   if(!alive)return;
   setApplication(rows.filter(r=>r.entity_type==='driver').sort((a,b)=>b.id-a.id)[0]??null);
   setQueryError(false);
  }).catch(()=>{if(alive)setQueryError(true);});
  return()=>{alive=false;};
 },[session.user?.id,session.user?.role]);
 if(session.loading)return <div className="df-auth"><p role="status">Verificando sesión…</p></div>;
 if(session.user?.role==='driver')return <Navigate to="/repartidor" replace/>;
 if(session.user){
  return <div className="df-auth"><main className="df-auth-inner">
    <h1>Tu acceso de repartidor</h1>
    <p>Hola, {session.user.name}. La plataforma verifica la aprobación de tu solicitud antes de permitir entregas.</p>
    <div className="df-surface df-message"><ShieldCheck size={22}/>
     <div><strong>{application?.status==='pending'?'Solicitud en revisión':application?.status==='needs_info'?'Se necesita información adicional':
       application?.status==='rejected'?'Solicitud no aprobada':application?.status==='approved'?'Reinicia sesión para actualizar tu rol':'Cuenta aún no aprobada'}</strong>
      <p>{queryError?'No pudimos verificar tu solicitud. Intenta actualizar.':
       application?.notes||'Solo ADMIN puede aprobar una cuenta de repartidor.'}</p></div></div>
    {session.user.role==='customer'&&<Link to="/repartidor/registro" className="df-primary df-link-button">Solicitar acceso como repartidor</Link>}
    <button className="df-text-button" type="button" onClick={()=>void session.logout().catch(e=>setError(messageOf(e)))}>Cerrar sesión y usar otra cuenta</button>
    {error&&<p role="alert" className="df-error">{error}</p>}
   </main></div>;
 }
 async function submit(e:FormEvent){
  e.preventDefault();if(busy)return;setBusy(true);setError('');
  try{await session.login(email.trim().toLowerCase(),password,otp.trim()||undefined);navigate('/repartidor',{replace:true});}
  catch(err){setError(messageOf(err));}finally{setBusy(false);}
 }
 return <div className="df-auth"><main className="df-auth-inner">
   <h1>Entra y empieza tu ruta.</h1>
   <p>Tus entregas, ganancias y recorrido en un solo lugar.</p>
   <form onSubmit={e=>void submit(e)} className="df-auth-form">
    <label>Correo electrónico<input type="email" name="email" autoComplete="username" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label>
    <label>Contraseña<input type="password" name="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></label>
    <label>Código 2FA <span className="df-optional">(si tu cuenta lo utiliza)</span><input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} disabled={busy}/></label>
    {error&&<div className="df-error" role="alert"><WifiOff size={17}/>{error}</div>}
    <button className="df-primary" type="submit" disabled={busy}>{busy?'Verificando acceso…':'Iniciar sesión'}</button>
   </form>
   <div className="df-install-inline"><DriverPwaInstallButton/></div>
   <div className="df-auth-footer"><span>¿Quieres repartir con Tala Eats?</span>
     <Link to="/repartidor/registro">Crear cuenta de repartidor</Link></div>
 </main></div>;
}

/** Temporary, on-device document previews. URLs are revoked on replacement/unmount. */
function DriverDocumentPreviews({files}:{files:File[]}){
 const [previews,setPreviews]=useState<Array<{name:string;size:number;url:string|null}>>([]);
 useEffect(()=>{
  const current=files.map(file=>({
   name:file.name,size:file.size,
   url:/^image\/(jpeg|png|webp)$/.test(file.type)?URL.createObjectURL(file):null,
  }));
  setPreviews(current);
  return()=>current.forEach(item=>{if(item.url)URL.revokeObjectURL(item.url);});
 },[files]);
 if(!previews.length)return null;
 return <ul className="df-document-previews" aria-label="Documentos seleccionados">
  {previews.map((preview,index)=><li key={index}>
   {preview.url?<img src={preview.url} alt={'Vista previa del documento '+(index+1)} loading="lazy"/>:
     <span className="df-document-file-icon"><FileCheck2 size={24}/></span>}
   <span className="df-document-filename"><strong>{preview.name}</strong><small>{readableOnboardingSize(preview.size)} · Solo en tu dispositivo hasta enviar</small></span>
  </li>)}
 </ul>;
}
type Capabilities={driver_plate_supported:boolean;driver_documents_supported:boolean;driver_admin_approval_required:boolean};

export function DriverRegistration(){
 const session=useSession();
 const [cap,setCap]=useState<Capabilities|null>(null);
 const [capError,setCapError]=useState('');
 const [existing,setExisting]=useState(false);
 const [name,setName]=useState('');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [phone,setPhone]=useState('');
 const [vehicle,setVehicle]=useState<DriverVehicle>('Motocicleta');
 const [plate,setPlate]=useState('');
 const [documents,setDocuments]=useState<File[]>([]);
 const [uploadProgress,setUploadProgress]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [complete,setComplete]=useState(false);
 const fileInput=useRef<HTMLInputElement|null>(null);
 const navigate=useNavigate();
 useEffect(()=>{
  let alive=true;
  void api.driverOnboardingCapabilities().then(value=>{
   if(!alive)return;
   if(value.driver_plate_supported===true&&value.driver_admin_approval_required===true)setCap(value);
   else setCapError('El backend todavía no admite el registro completo de placas y aprobación administrativa.');
  }).catch(e=>{if(alive)setCapError(e instanceof ApiError&&e.status===404
   ?'Estamos preparando el registro de repartidores con placas. No crearemos cuentas incompletas.'
   :'No se pudo verificar el registro del servidor. Intenta nuevamente.');});
  return()=>{alive=false;};
 },[]);
 if(session.loading)return <div className="df-auth"><p role="status">Verificando sesión…</p></div>;
 if(session.user?.role==='driver')return <Navigate to="/repartidor" replace/>;
 if(session.user&&session.user.role!=='customer')return <Navigate to="/repartidor/acceso" replace/>;
 const usingSession=session.user?.role==='customer';
 async function submit(e:FormEvent){
  e.preventDefault();if(busy||!cap)return;
  setError('');
  const normalized=normalizeDriverPlate(plate);
  if(!driverPlateIsValid(vehicle,normalized)){setError(vehicle==='Bicicleta'?'Revisa el vehículo.':'Escribe las placas válidas de tu vehículo.');return;}
  if(phone.replace(/\D/g,'').length<7||phone.length>30){setError('Escribe un teléfono de contacto válido.');return;}
  if(!usingSession&&(!name.trim()||name.trim().length<2||!/^\S+@\S+\.\S+$/.test(email)||password.length<8)){
   setError('Revisa nombre, correo y contraseña (mínimo 8 caracteres).');return;
  }
  const selectionIssue=onboardingSelectionError(documents);
  if(selectionIssue){setError(selectionIssue);return;}
  setBusy(true);setUploadProgress(documents.length?'Preparando documentos de forma privada en tu dispositivo…':'');
  let createdThisAttempt=false;
  try{
   // Validate signature and optimize large mobile photographs BEFORE creating
   // an account, so an incompatible file cannot leave a half-registered user.
   const prepared=await prepareOnboardingDocuments(documents);
   if(!usingSession){
    // This can create a customer account only after the plate-capability
    // handshake succeeds. If onboarding fails, re-enter via existing account.
    await session.register(name.trim(),email.trim().toLowerCase(),password);
    createdThisAttempt=true;setExisting(true);
   }
   await api.updateProfile(session.user?.name||name.trim(),phone.trim());
   const urls:string[]=[];
   for(const [index,file] of prepared.entries()){
    setUploadProgress('Subiendo documento '+(index+1)+' de '+prepared.length+'…');
    urls.push((await api.driverOnboardingDocument(file)).url);
   }
   setUploadProgress('Enviando solicitud para aprobación…');
   const application=await api.driverOnboardingSubmit(vehicle,normalized,urls);
   if(application.status!=='pending')throw new Error('No se confirmó que la solicitud esté pendiente. Comprueba tu estado antes de reintentar.');
   await session.logout();
   setComplete(true);
  }catch(err){setError(messageOf(err)+(createdThisAttempt?' La cuenta ya se creó: utiliza esta misma cuenta para reintentar.':''));}
  finally{setBusy(false);setUploadProgress('');}
 }
 if(complete)return <div className="df-auth"><main className="df-auth-inner df-success"><CheckCircle2 size={52}/>
  <h1>Solicitud enviada</h1><p>Tu cuenta quedó pendiente de revisión de ADMIN. Cuando sea aprobada podrás iniciar sesión como repartidor.</p>
  <Link to="/repartidor/acceso" className="df-primary df-link-button">Ir a iniciar sesión</Link>
 </main></div>;
 return <div className="df-auth"><main className="df-auth-inner df-register">
  <Link className="df-back" to="/repartidor/acceso"><ArrowLeft size={18}/> Volver a iniciar sesión</Link>
  <h1>Únete a la red de repartidores.</h1>
  <p>Crea tu cuenta, registra tu vehículo y envía tu solicitud. ADMIN revisará tu información antes de autorizar entregas.</p>
  {!cap&&<div role="status" className="df-message df-surface"><ShieldCheck size={21}/><div><strong>Verificando disponibilidad del registro</strong>
   <p>{capError||'Consultando las funciones habilitadas en el backend…'}</p></div></div>}
  {usingSession&&<div className="df-message df-surface"><UserRound size={22}/><div><strong>Usar cuenta existente</strong><p>Continuarás con {session.user?.email}; no se creará otra cuenta.</p></div></div>}
  <form onSubmit={e=>void submit(e)} className="df-auth-form">
   {!usingSession&&<>
    <label>Nombre completo<input autoComplete="name" maxLength={120} required minLength={2} value={name} onChange={e=>setName(e.target.value)} disabled={busy||!cap}/></label>
    <label>Correo electrónico<input type="email" autoComplete="email" maxLength={254} required value={email} onChange={e=>setEmail(e.target.value)} disabled={busy||!cap}/></label>
    <label>Crear contraseña<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy||!cap}/></label>
   </>}
   <label>Teléfono de contacto<input type="tel" autoComplete="tel" inputMode="tel" required maxLength={30} value={phone} onChange={e=>setPhone(e.target.value)} disabled={busy||!cap}/></label>
   <label>Vehículo principal<select value={vehicle} onChange={e=>{setVehicle(e.target.value as DriverVehicle);setPlate('');}} disabled={busy||!cap}>
    <option value="Motocicleta">Motocicleta</option><option value="Automóvil">Automóvil</option><option value="Bicicleta">Bicicleta</option></select></label>
   {vehicle!=='Bicicleta'&&<label>Número de placas<input autoComplete="off" required maxLength={30} placeholder="Ej. ABC-1234"
    value={plate} onChange={e=>setPlate(normalizeDriverPlate(e.target.value))} disabled={busy||!cap}/><small>Se utilizará para la verificación del vehículo. No se publica en entregas.</small></label>}
   <label>Documentos de verificación <span className="df-optional">(opcional, hasta 3)</span>
     <span className="df-file-picker"><UploadCloud size={18}/> Adjuntar identificación, licencia o tarjeta de circulación
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf" multiple onChange={e=>{
       const next=Array.from(e.target.files||[]);
       const issue=onboardingSelectionError(next);
       if(issue){setDocuments([]);e.currentTarget.value='';setError(issue);}
       else{setDocuments(next);setError('');}
      }} disabled={busy||!cap||!cap.driver_documents_supported}/></span>
      <small>{documents.length?documents.length+' documento(s) seleccionados · se subirán al enviar la solicitud':'Máximo 5 MB por documento. Las fotos grandes se optimizan en tu dispositivo.'}</small>
      <DriverDocumentPreviews files={documents}/></label>
   <div className="df-message df-surface"><FileCheck2 size={21}/><p>Tu solicitud no habilita entregas ni pagos. Solo podrás operar cuando ADMIN apruebe tu información y el servidor valide tu GPS.</p></div>
   {uploadProgress&&<div role="status" className="df-upload-progress">{uploadProgress}</div>}
   {error&&<div className="df-error" role="alert"><WifiOff size={17}/>{error}</div>}
   <button type="submit" className="df-primary" disabled={!cap||busy}>
    {busy?'Enviando solicitud…':'Crear cuenta y enviar solicitud'}</button>
  </form>
  {existing&&<p className="df-warning"><Smartphone size={17}/> Tu cuenta ya pudo haberse creado; no la registres de nuevo si hay un error.</p>}
  <div className="df-install-inline"><DriverPwaInstallButton/></div>
  <button type="button" className="df-text-button" onClick={()=>navigate('/repartidor/acceso')}>Ya tengo una cuenta</button>
 </main></div>;
}

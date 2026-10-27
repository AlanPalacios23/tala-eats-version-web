import {useState} from 'react';
import {Link} from 'react-router-dom';
import {ShieldCheck,RefreshCw,Store} from 'lucide-react';
import {api} from '../lib/api';

/** Operational mapping requires a real MFA-authenticated admin token.
 * The server verifies ownership + Stripe account identity and creates no
 * payment or transfer. Never auto-map an account to a merchant.
 */
export function AdminPickupConnect(){
 const [restaurant,setRestaurant]=useState(''),[stripeAccount,setStripeAccount]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [status,setStatus]=useState<Awaited<ReturnType<typeof api.adminConnectStatus>>|null>(null);
 const id=Number(restaurant),validId=/^[1-9]\d{0,9}$/.test(restaurant)&&Number.isSafeInteger(id);
 const validAccount=/^acct_[A-Za-z0-9]+$/.test(stripeAccount);
 async function check(){
  if(!validId||busy)return;
  setBusy(true);setError('');setNotice('');setStatus(null);
  try{setStatus(await api.adminConnectStatus(id));}
  catch(e){setError(e instanceof Error?e.message:'No fue posible revisar el comercio.');}
  finally{setBusy(false);}
 }
 async function link(){
  if(busy||!validId||!validAccount)return;
  const masked='••••'+stripeAccount.slice(-4);
  if(!window.confirm('Confirma que verificaste personalmente la titularidad del restaurante #'+id+
     ' y que la cuenta Connect terminada en '+masked+' pertenece al propietario real. La vinculación es LIVE.'))return;
  setBusy(true);setError('');setNotice('');setStatus(null);
  try{
   const result=await api.adminConnectMap(id,stripeAccount);
   if(result.restaurant_id!==id||result.status!=='owner_confirmation_required')
    throw new Error('El backend no confirmó la solicitud de aprobación por el propietario.');
   setNotice('Vinculación registrada. El dueño debe ingresar a Mi negocio y confirmar titularidad; después completa Stripe Connect.');
   setStripeAccount('');
  }catch(e){setError(e instanceof Error?e.message:'No fue posible vincular el comercio.');}
  finally{setBusy(false);}
 }
 return <div className="container page dashboard">
  <header className="dashboard-heading"><div><span className="eyebrow">ADMIN · TALA EATS LIVE</span>
   <h1>Autorizar comercio para recoger</h1>
   <p>Vincula Stripe Connect únicamente a un restaurante real cuyo propietario hayas verificado.</p>
  </div><ShieldCheck size={32}/></header>
  <section className="card padded">
   <h2>Vinculación autorizada</h2>
   <p className="fineprint">Solo un administrador autenticado con MFA puede realizar esta acción. No genera pagos, cargos ni transferencias.</p>
   <div className="form-grid">
    <label>ID del restaurante verificado
     <input required inputMode="numeric" pattern="[1-9][0-9]*" placeholder="ID real del comercio"
      value={restaurant} disabled={busy} onChange={e=>{setRestaurant(e.target.value.replace(/\D/g,'').slice(0,10));setStatus(null);setError('');}}/>
    </label>
    <label>Cuenta Stripe Connect del propietario
     <input autoComplete="off" spellCheck={false} placeholder="acct_…"
      value={stripeAccount} disabled={busy} onChange={e=>setStripeAccount(e.target.value.trim().slice(0,90))}/>
    </label>
   </div>
   {error&&<p role="alert" className="mobile-address-error">{error}</p>}
   {notice&&<p role="status" className="mobile-profile-saved">{notice}</p>}
   <div className="action-buttons">
    <button type="button" className="btn primary" disabled={!validId||!validAccount||busy}
      onClick={()=>void link()}><Store size={16}/> Vincular negocio LIVE con confirmación</button>
    <button type="button" className="btn outline" disabled={!validId||busy}
      onClick={()=>void check()}><RefreshCw size={16}/> Consultar verificación</button>
   </div>
   {status&&<div className="card padded"><h3>Estado de autorización del comercio #{status.restaurant_id}</h3>
    <p>Dueño aprobó: <strong>{status.owner_approved?'Sí':'Pendiente'}</strong></p>
    <p>Documentación enviada: <strong>{status.details_submitted?'Sí':'Pendiente'}</strong></p>
    <p>Transferencias disponibles: <strong>{status.transfers_active?'Sí':'Pendiente'}</strong></p>
    <p>Retiros habilitados: <strong>{status.payouts_enabled?'Sí':'Pendiente'}</strong></p>
    <p>Transferencias automáticas de Tala Eats: <strong>Desactivadas</strong></p>
   </div>}
   <p className="fineprint">No uses la cuenta Connect de la plataforma para un restaurante ni vincules la cuenta de otro comerciante. El backend rechazará incompatibilidades verificadas con Stripe.</p>
  </section>
  <p><Link to="/admin/solicitudes-restaurantes">Revisar y aprobar solicitudes de restaurantes</Link></p>
  <p><Link to="/">Regresar al inicio</Link></p>
 </div>;
}

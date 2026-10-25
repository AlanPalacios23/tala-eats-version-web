import {useEffect,useState} from 'react';
import {ArrowLeft,ChevronRight,Download,FileText,LockKeyhole,ShieldCheck,Trash2} from 'lucide-react';
import {Link} from 'react-router-dom';
import {api} from '../lib/api';

export const LEGAL_UPDATED='7 de octubre de 2026';
const terms=[
['1. Uso de Tala Eats','Tala Eats permite consultar comercios participantes, seleccionar productos, realizar pedidos y dar seguimiento a su estado. Debes proporcionar información verdadera, mantener segura tu cuenta y utilizar el servicio únicamente para fines lícitos.'],
['2. Pedidos y disponibilidad','Los productos, horarios, existencias, zonas de cobertura, tiempos estimados y condiciones de entrega dependen de la disponibilidad informada por cada comercio y de la operación de Tala Eats. El pedido queda sujeto a confirmación del sistema y del comercio correspondiente.'],
['3. Precios, cargos y pagos','Antes de confirmar un pedido se mostrará el importe aplicable, incluyendo productos, entrega, propina y cargos o descuentos vigentes. Los pagos electrónicos se procesan mediante proveedores externos autorizados. Tala Eats no debe considerar un pago aprobado hasta recibir confirmación del servidor y del proveedor de pago.'],
['4. Cancelaciones y reembolsos','Las posibilidades de cancelar, modificar o reembolsar un pedido dependen del estado del pedido, de la preparación realizada y de las políticas vigentes mostradas al usuario. Cuando corresponda, los reembolsos se tramitarán por el medio y plazo aplicable.'],
['5. Entrega y recogida','Debes proporcionar una dirección y ubicación correctas cuando solicites entrega. Para pedidos de recogida, eres responsable de acudir al comercio indicado. Los tiempos mostrados son estimados y pueden variar por demanda, tráfico, clima, operación del comercio u otras circunstancias.'],
['6. Promociones y beneficios','Cupones, puntos, recompensas y promociones pueden tener vigencia, disponibilidad, límites y condiciones específicas. Su aplicación final será la que valide el servidor de Tala Eats al procesar el pedido.'],
['7. Conducta y seguridad','No está permitido intentar vulnerar el servicio, usar cuentas ajenas, realizar pedidos fraudulentos, abusar de promociones ni utilizar Tala Eats de forma que afecte a comercios, repartidores, usuarios o a la plataforma.'],
['8. Disponibilidad del servicio','Tala Eats puede realizar mantenimiento, corregir errores, suspender temporalmente funciones o modificar características cuando sea necesario para seguridad, operación o cumplimiento. Se procurará informar los cambios relevantes cuando corresponda.'],
['9. Soporte','Si tienes un problema con tu cuenta, pedido o pago, utiliza los canales de soporte disponibles en la aplicación. Conserva la información del pedido para facilitar la atención.']
];
const privacy=[
['Datos que podemos tratar','Según las funciones que utilices, Tala Eats puede tratar datos de cuenta y contacto, direcciones y ubicación para entrega, información de pedidos, preferencias, comunicaciones de soporte, datos técnicos de seguridad y referencias necesarias para procesar pagos mediante proveedores externos.'],
['Finalidades principales','Los datos se utilizan para crear y administrar tu cuenta, autenticarte, procesar y entregar pedidos, calcular cobertura y tarifas, atender soporte, prevenir fraude, proteger la seguridad del servicio, generar comprobaciones operativas y cumplir obligaciones aplicables.'],
['Proveedores y comercios','La información estrictamente necesaria puede compartirse con comercios, repartidores, proveedores de pago, infraestructura, mensajería o servicios técnicos que participen en la operación del pedido o de la plataforma, conforme a sus funciones y a la normativa aplicable.'],
['Ubicación','Cuando solicites entrega, Tala Eats puede utilizar la dirección o ubicación que autorices para validar cobertura, calcular tarifas y facilitar la entrega. Puedes administrar tus direcciones desde la aplicación y los permisos de ubicación desde el sistema operativo de tu dispositivo.'],
['Seguridad y conservación','Tala Eats aplica medidas técnicas y organizativas para proteger la información. La sesión se almacena mediante mecanismos seguros del dispositivo o navegador. La información se conserva durante el tiempo necesario para las finalidades descritas y para obligaciones legales, de seguridad, prevención de fraude o resolución de disputas.'],
['Tus decisiones y derechos','Desde la sección Privacidad puedes administrar preferencias disponibles y solicitar acceso o exportación de tus datos y, cuando proceda, la eliminación de tu cuenta. Algunas obligaciones legales o de seguridad pueden requerir conservar determinada información durante un periodo adicional.'],
['Contacto','Para solicitudes relacionadas con privacidad o soporte puedes utilizar la sección Ayuda y soporte de Tala Eats.']
];
function Header({title,back='/cuenta'}:{title:string;back?:string}){return <div className="mobile-detail-header"><Link to={back} aria-label="Regresar"><ArrowLeft size={22}/></Link><h1>{title}</h1></div>}
export function CustomerLegal({kind}:{kind:'terms'|'notice'}){
 const isTerms=kind==='terms',data=isTerms?terms:privacy;
 return <article className="mobile-customer-page customer-legal" data-mobile-screen={kind}>
  <Header title={isTerms?'Términos y condiciones':'Aviso de privacidad'}/>
  <div className="customer-legal-document"><div className="customer-legal-icon"><FileText size={25}/></div>
   <h2>{isTerms?'Términos y Condiciones de Uso':'Aviso de Privacidad'}</h2>
   <p className="customer-legal-date">Última actualización: {LEGAL_UPDATED}</p>
   {data.map(([title,body])=><section key={title}><h3>{title}</h3><p>{body}</p></section>)}
   <Link to="/soporte" className="customer-legal-help">Ayuda y soporte <ChevronRight size={18}/></Link>
  </div>
 </article>;
}
const preferences=[
 {key:'personalization_opt_in',label:'Experiencia personalizada',desc:'Usar tus favoritos y pedidos para recomendarte mejor.'},
 {key:'analytics_opt_in',label:'Analítica de producto',desc:'Ayudar a mejorar el rendimiento de la app.'},
 {key:'marketing_opt_in',label:'Comunicaciones',desc:'Promociones y novedades de Tala Eats.'}
] as const;
type PreferenceKey=typeof preferences[number]['key'];
type PreferenceValues=Record<PreferenceKey,boolean>;
function parsePreferences(raw:unknown):PreferenceValues{
 if(!raw||typeof raw!=='object')throw new Error('El servidor no proporcionó preferencias verificables.');
 const d=raw as Record<string,unknown>;
 if(!preferences.every(p=>typeof d[p.key]==='boolean'))throw new Error('El servidor no confirmó las preferencias actuales.');
 return {personalization_opt_in:d.personalization_opt_in as boolean,analytics_opt_in:d.analytics_opt_in as boolean,marketing_opt_in:d.marketing_opt_in as boolean};
}
export function CustomerPrivacy(){
 const [values,setValues]=useState<PreferenceValues|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[deletion,setDeletion]=useState(false),[typed,setTyped]=useState(''),[uncertain,setUncertain]=useState(false);
 useEffect(()=>{let active=true;api.privacyPreferences().then(data=>{if(active)setValues(parsePreferences(data));}).catch(e=>{if(active)setError(e instanceof Error?e.message:'No se pudieron consultar las preferencias.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
 async function toggle(key:PreferenceKey){
  if(!values||busy)return;setBusy(true);setError('');setMessage('');
  try{
   const payload={...values,[key]:!values[key]};
   const reply=await api.updatePrivacyPreferences(payload);
   setValues(parsePreferences(reply));setMessage('Preferencias verificadas y actualizadas.');
  }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar la preferencia.');}
  finally{setBusy(false);}
 }
 async function requestPrivacy(kind:'delete'|'export'){
  if(busy||uncertain||kind==='delete'&&typed!=='ELIMINAR')return;
  setBusy(true);setError('');setMessage('');
  try{
   // A request is not a deletion: users keep access while it is processed.
   const reply=await api.privacyRequest(kind);
   if(!reply||typeof reply!=='object')throw new Error('El servidor no confirmó el registro de la solicitud.');
   setMessage(kind==='delete'?'Solicitud de eliminación recibida por el servidor. Tu cuenta no se ha eliminado inmediatamente.':'Solicitud de exportación recibida por el servidor.');
   setDeletion(false);setTyped('');
  }catch(e){setUncertain(true);setError((e instanceof Error?e.message:'No pudimos confirmar la solicitud.')+' Consulta soporte antes de enviarla otra vez.');}
  finally{setBusy(false);}
 }
 return <div className="mobile-customer-page customer-privacy" data-mobile-screen="privacy">
  <Header title="Privacidad"/>
  <p className="customer-privacy-intro">Decide cómo se usan tus preferencias en Tala Eats.</p>
  <section className="customer-settings-group"><h2>Preferencias</h2>
   {loading?<p className="customer-privacy-help">Consultando preferencias de tu cuenta…</p>:!values?<p className="customer-privacy-help">Las preferencias no están disponibles y no se han cambiado.</p>:
    preferences.map(p=><label className="customer-settings-toggle" key={p.key}><span><strong>{p.label}</strong><small>{p.desc}</small></span><input type="checkbox" disabled={busy} checked={values[p.key]} onChange={()=>void toggle(p.key)}/></label>)}
  </section>
  <section className="customer-settings-group"><h2>Tus datos</h2>
   <button className="customer-settings-action" onClick={()=>void requestPrivacy('export')} disabled={busy||uncertain}><Download size={21}/><span><strong>Solicitar mis datos</strong><small>Pide una copia de tu información; el servidor confirmará la solicitud.</small></span><ChevronRight size={19}/></button>
   <button className="customer-settings-action danger" onClick={()=>setDeletion(true)} disabled={busy||uncertain}><Trash2 size={21}/><span><strong>Eliminar mi cuenta</strong><small>Solicita la eliminación con confirmación adicional.</small></span><ChevronRight size={19}/></button>
  </section>
  <div className="customer-settings-group customer-privacy-note"><LockKeyhole size={19}/><span>Estas preferencias se guardan en tu cuenta solamente cuando el servidor confirma el cambio.</span></div>
  {error&&<div role="alert" className="mobile-address-error">{error}</div>}
  {message&&<p role="status" className="mobile-profile-saved"><ShieldCheck size={17}/>{message}</p>}
  {deletion&&<div className="customer-deletion-backdrop" role="presentation"><div className="customer-deletion-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-delete-heading">
   <Trash2 size={30} color="#b3261e"/>
   <h2 id="customer-delete-heading">Solicitar eliminación de cuenta</h2>
   <p>Registraremos una solicitud, no una eliminación inmediata. Algunas obligaciones legales y de seguridad pueden requerir conservar cierta información durante un periodo adicional.</p>
   <label>Escribe <strong>ELIMINAR</strong> para confirmar<input value={typed} onChange={e=>setTyped(e.target.value)} maxLength={8} autoComplete="off" placeholder="ELIMINAR" /></label>
   <div className="customer-deletion-actions"><button type="button" disabled={busy} onClick={()=>{setDeletion(false);setTyped('')}}>Cancelar</button><button type="button" disabled={busy||typed!=='ELIMINAR'} onClick={()=>void requestPrivacy('delete')}>{busy?'Enviando…':'Enviar solicitud'}</button></div>
  </div></div>}
 </div>;
}

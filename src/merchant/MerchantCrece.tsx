import {useEffect,useMemo,useState} from 'react';
import {
  ArrowRight,BarChart3,Camera,Check,ChevronDown,Copy,Gift,
  QrCode,ShieldCheck,Sparkles,Store,TrendingUp
} from 'lucide-react';
import {api} from '../lib/api';
import CreceCalculator from './CreceCalculator';
import {checkPublicStorefront,CRECE_QR_PNG,CRECE_PUBLIC_REVALIDATE_MS,
 mayShareStorefront,type StorePublication} from './crecePublication';
import type {Restaurant} from '../lib/types';
import {
  CRECE_BENEFITS,CRECE_PILLARS,FOUNDERS_OFFER,creceAdvice,storefrontLink,
  merchantProfileChecklist,
  type BenefitState,type CreceMetrics,type CrecePillar
} from './creceContracts';
import './crece.css';

const STATUS:Record<BenefitState,string>={
 disponible:'Disponible en la app',
 asistido:'Con apoyo del equipo',
 planeado:'En preparación'
};
type Filter='principal'|'disponible'|'asistido'|'planeado';

export default function MerchantCrece({restaurant,metrics,onNavigate}:{
 restaurant:Restaurant|null;
 metrics:CreceMetrics|null;
 onNavigate:(section:'pedidos'|'menu'|'rendimiento'|'negocio'|'crece')=>void;
}){
 const [filter,setFilter]=useState<Filter>('principal');
 const [expanded,setExpanded]=useState(false);
 const [qr,setQr]=useState<string|null>(null);
 const [feedback,setFeedback]=useState('');
 const [publication,setPublication]=useState<StorePublication>({
  id:null,status:'idle',revision:0
 });
 const [recheck,setRecheck]=useState(0);
 const [online,setOnline]=useState(()=>typeof navigator==='undefined'||navigator.onLine);
 // A QR is evidence of a public catalog check at one moment, not a permanent
 // guarantee. Hide it immediately on offline/refresh and revalidate on return.
 useEffect(()=>{
  const refresh=()=>setRecheck(previous=>previous+1);
  const onOffline=()=>{setOnline(false);refresh();};
  const onOnline=()=>{setOnline(true);refresh();};
  const onVisible=()=>{
   if(document.visibilityState==='visible')refresh();
  };
  const interval=window.setInterval(()=>{
   if(document.visibilityState==='visible'&&navigator.onLine)refresh();
  },CRECE_PUBLIC_REVALIDATE_MS);
  window.addEventListener('offline',onOffline);
  window.addEventListener('online',onOnline);
  document.addEventListener('visibilitychange',onVisible);
  return()=>{
   window.clearInterval(interval);
   window.removeEventListener('offline',onOffline);
   window.removeEventListener('online',onOnline);
   document.removeEventListener('visibilitychange',onVisible);
  };
 },[]);
 const link=useMemo(()=>storefrontLink(
  restaurant?.id,import.meta.env.VITE_TALA_CUSTOMERS_BASE_URL
 ),[restaurant?.id]);
 // Backend public catalog AND detail must independently acknowledge this
 // exact store. A configured domain or private merchant identity is not
 // sufficient to issue a public marketing QR.
 useEffect(()=>{
  let active=true;
  const controller=new AbortController();
  const id=restaurant?.id;
  if(!link||typeof id!=='number'||!Number.isSafeInteger(id)||id<=0){
   setPublication({id:null,status:'idle',revision:recheck});
   return()=>{active=false;controller.abort();};
  }
  if(!online){
   setPublication({id,status:'offline',revision:recheck});
   return()=>{active=false;controller.abort();};
  }
  setPublication({id,status:'checking',revision:recheck});
  void checkPublicStorefront({
   storeId:id,signal:controller.signal,
   fetchPage:(offset,limit,signal)=>api.restaurantsPage(offset,limit,signal),
   fetchDetail:(store,signal)=>api.restaurant(store,signal)
  }).then(status=>{
   if(active)setPublication({id,status,revision:recheck});
  }).catch(()=>{
   if(active)setPublication({id,status:'error',revision:recheck});
  });
  return()=>{active=false;controller.abort();};
 },[link,restaurant?.id,recheck,online]);
 const publicationState=!online?'offline':
  publication.id===restaurant?.id&&publication.revision===recheck?
   publication.status:'checking';
 const shareableLink=link&&mayShareStorefront({
  publication,storeId:restaurant?.id,revision:recheck,online
 })?link:null;
 useEffect(()=>{
  let active=true;
  setQr(null);
  if(shareableLink)void import('qrcode')
   .then(module=>module.default.toDataURL(shareableLink,CRECE_QR_PNG))
   .then(data=>{if(active)setQr(data);})
   .catch(()=>{if(active)setQr(null);});
  return()=>{active=false;};
 },[shareableLink]);
 const suggestions=creceAdvice(metrics);
 const checklist=merchantProfileChecklist(restaurant,Boolean(shareableLink));
 const completed=checklist.filter(s=>s.done).length;
 const shown=CRECE_BENEFITS.filter(b=>{
  if(filter==='principal')return b.phase===1;
  return b.state===filter;
 });
 const copy=async(value:string,label:string)=>{
  try{await navigator.clipboard.writeText(value);setFeedback(label);}
  catch{setFeedback('No se pudo copiar automáticamente. Selecciona y copia el enlace del campo.');}
 };
 const shareText=shareableLink&&restaurant?.name?
  `Conoce ${restaurant.name} en Tala Eats: ${shareableLink}`:null;
 return <section className="crece-shell" aria-label="Programa Tala Eats Crece">
  <header className="crece-hero">
   <span className="crece-overline"><Sparkles size={15}/> TALA EATS CRECE</span>
   <div className="crece-hero-grid"><div>
    <h1>Tu negocio merece crecer.</h1>
    <p>Tu espacio para mejorar la presencia digital, organizar el día a día y aprovechar las herramientas disponibles en Tala Eats.</p>
    <div className="crece-hero-points"><span><Check size={15}/> Propuesta: sin mensualidad fija</span><span><ShieldCheck size={15}/> Sin exclusividad obligatoria en la propuesta</span></div>
   </div><div className="crece-hero-emblem" aria-hidden="true"><TrendingUp size={78}/><span>CRECE</span></div></div>
  </header>

  <div className="crece-briefs" aria-label="Condiciones propuestas del programa Fundadores">
   <div><strong>10</strong><span>Plazas máximas previstas para Fundadores</span></div>
   <div><strong>$0</strong><span>Cuota propuesta de alta y mensualidad</span></div>
   <div><strong>17%</strong><span>Comisión estándar sobre productos</span></div>
  </div>

  <div className="crece-section-heading"><div><span className="crece-kicker">HERRAMIENTAS PARA TI</span>
   <h2>Todo lo que Tala Eats puede aportar</h2>
   <p>Las funciones de la app se distinguen de los servicios asistidos y las ideas futuras. Ningún beneficio pendiente se considera activado.</p>
  </div></div>
  <div className="crece-pillar-grid">
   {CRECE_PILLARS.map(p=><div className="crece-pillar" key={p.id}>
    <span>{p.id==='identidad'?<Camera/>:p.id==='visibilidad'?<Gift/>:p.id==='operacion'?<Store/>:p.id==='finanzas'?<BarChart3/>:<TrendingUp/>}</span>
    <strong>{p.label}</strong><small>{p.caption}</small>
   </div>)}
  </div>

  <div className="crece-section-heading"><div><span className="crece-kicker">PROGRAMA FUNDADORES</span>
   <h2>Ventajas desde el lanzamiento</h2><p>Fotografías, asesoría y espacios destacados están sujetos a revisión, agenda y aceptación formal del comercio.</p>
  </div></div>
  <div className="crece-founder-grid">
   <div className="crece-founder-card"><Camera size={22}/><strong>Hasta 10 fotografías</strong><span>Sesión coordinada por el equipo durante el piloto</span></div>
   <div className="crece-founder-card"><Gift size={22}/><strong>Hasta 30 días destacados</strong><span>Según disponibilidad y reglas transparentes de visibilidad</span></div>
   <div className="crece-founder-card"><Store size={22}/><strong>Configuración asistida</strong><span>Menú, horarios, materiales y capacitación inicial</span></div>
  </div>
  <p className="crece-disclaimer">Estas ventajas son una propuesta piloto, no una inscripción automática. No se asigna una de las {FOUNDERS_OFFER.capacity} plazas sin aprobación administrativa. No se garantizan ventas ni resultados.</p>

  <section className="crece-readiness" aria-label="Preparación del perfil comercial">
   <div className="crece-section-heading"><div>
    <span className="crece-kicker">TU PERFIL DIGITAL</span>
    <h2>Prepara tu tienda para que la descubran</h2>
    <p>Checklist basado en datos del servidor; no certifica pagos, logística, afiliación ni autorización de venta.</p>
   </div></div>
   {checklist.length?<div className="crece-readiness-layout">
    <div className="crece-readiness-score"><span>Información preparada</span>
     <strong>{completed}<small> / {checklist.length}</small></strong>
     <progress max={checklist.length} value={completed} aria-label="Elementos del perfil preparados"/>
     <p>Revisa cada punto antes de compartir tu catálogo. Los campos completos no garantizan la publicación comercial.</p>
    </div>
    <div className="crece-readiness-list">{checklist.map(step=>
     <div className="crece-readiness-item" key={step.id}>
      <span className={step.done?'done':'pending'} aria-hidden="true">{step.done?<Check size={16}/>:<span/>}</span>
      <div><strong>{step.title}</strong><p>{step.description}</p></div>
      {!step.done&&step.target!=='crece'&&<button type="button" onClick={()=>onNavigate(step.target)}>
       Revisar <ArrowRight size={15}/></button>}
     </div>)}</div>
   </div>:<div className="crece-data-empty">El perfil de comercio aún no está disponible desde el servidor.</div>}
  </section>

  <section className="crece-share" aria-label="Herramientas para compartir tu tienda">
   <div><span className="crece-kicker">TU TIENDA, EN TODAS PARTES</span>
    <h2>Comparte tu menú con un QR</h2>
    <p>Para evitar enlaces rotos, verificamos que tu tienda aparezca en el listado público y abra su detalle desde el backend de clientes.</p>
    {shareableLink?<><label className="crece-link-label" htmlFor="crece-store-link">Enlace público verificado</label>
      <div className="crece-link-field"><input id="crece-store-link" readOnly value={shareableLink} onFocus={e=>e.currentTarget.select()}/><button type="button" onClick={()=>void copy(shareableLink,'Enlace copiado.')}><Copy size={16}/> Copiar</button></div>
      <a className="crece-public-test-link" href={shareableLink}
       target="_blank" rel="noopener noreferrer">
       Abrir mi tienda en Clientes para comprobar el enlace <ArrowRight size={15}/>
      </a>
      {shareText&&<button className="crece-share-message" type="button" onClick={()=>void copy(shareText,'Mensaje listo para compartir.')}><Copy size={16}/> Copiar mensaje para tus clientes</button>}
    </>:<div className="crece-no-link" role="status">El enlace y QR todavía no están disponibles. {!link?'Configura el dominio HTTPS oficial de clientes y comprueba el identificador de la tienda.':publicationState==='offline'?'Sin conexión: el QR se desactiva hasta comprobar de nuevo el catálogo.':publicationState==='checking'?'Verificando publicación en el catálogo de clientes…':publicationState==='not-public'?'El negocio no aparece confirmado en el listado y detalle públicos. Revisa su publicación antes de compartirlo.':publicationState==='limit'?'La lista pública superó el límite de verificación. Solicita una comprobación individual al equipo antes de compartir el QR.':'No se pudo comprobar el catálogo público del servidor.'}
     {online&&link&&publicationState!=='checking'&&<button className="crece-retry" type="button" onClick={()=>setRecheck(v=>v+1)}>Comprobar de nuevo <ArrowRight size={15}/></button>}
    </div>}
    {feedback&&<p className="crece-feedback" role="status">{feedback}</p>}
   </div><div className="crece-qr-panel">{qr&&shareableLink?<img src={qr} alt={'Código QR del enlace público de '+(restaurant?.name||'tu negocio')} width={220} height={220}/>:<div className="crece-qr-empty"><QrCode size={65}/><small>QR no disponible hasta configurar el enlace público</small></div>}
   <span>{restaurant?.name||'Tu negocio'}</span><small>{shareableLink?'Publicación comprobada con el servidor':'No compartir sin publicación confirmada'}</small>
   {qr&&shareableLink&&<a className="crece-qr-download"
    href={qr} download={`tala-eats-qr-comercio-${restaurant?.id}.png`}
    aria-label="Guardar imagen PNG del QR de tu comercio">
    Guardar QR en PNG <ArrowRight size={15}/></a>}</div>
  </section>

  <CreceCalculator/>

  <section className="crece-recommend" aria-label="Consejos para mejorar tu comercio">
   <div className="crece-section-heading"><div><span className="crece-kicker">EL PASO QUE SIGUE</span>
     <h2>Ideas basadas en tu operación</h2>
     <p>No mostramos estimaciones de ventas ni datos de clientes inventados.</p>
    </div></div>
   {!metrics?<div className="crece-data-empty" role="status">Los indicadores no están confirmados por la API. Las recomendaciones personalizadas estarán disponibles cuando el servidor proporcione datos válidos.</div>:
    suggestions.length? <div className="crece-recommend-grid">{suggestions.map(s=><div className="crece-recommend-card" key={s.id}><span><TrendingUp size={20}/></span><div><h3>{s.title}</h3><p>{s.detail}</p><button type="button" onClick={()=>onNavigate(s.target)}>Ir a {s.target==='menu'?'mi menú':s.target==='pedidos'?'pedidos':'rendimiento'} <ArrowRight size={15}/></button></div></div>)}</div>:
    <div className="crece-data-empty" role="status">Los indicadores recibidos no permiten generar una recomendación verificable.</div>}
  </section>

  <section className="crece-directory" id="crece-beneficios">
   <div className="crece-section-heading"><div><span className="crece-kicker">CATÁLOGO DE BENEFICIOS</span>
    <h2>Conoce las {CRECE_BENEFITS.length} oportunidades</h2><p>Filtra por disponibilidad. Los proyectos futuros no son funcionalidades activas ni servicios contratados.</p>
   </div></div>
   <div className="crece-filters" role="group" aria-label="Filtrar beneficios">
    {([['principal','Para comenzar'],['disponible','En la app'],['asistido','Con apoyo'],['planeado','Próximamente']] as const).map(([id,label])=>
      <button key={id} type="button" aria-pressed={filter===id} className={filter===id?'selected':''} onClick={()=>{setFilter(id);setExpanded(false)}}>{label}</button>)}
   </div>
   <div className="crece-directory-grid">
    {(expanded?shown:shown.slice(0,9)).map(item=><article className="crece-benefit" key={item.id}>
     <span className={'crece-benefit-status '+item.state}>{STATUS[item.state]}</span>
     <h3>{item.title}</h3><p>{item.description}</p>
     <small>{CRECE_PILLARS.find(p=>p.id===(item.pillar as CrecePillar))?.label} · Etapa {item.phase}</small>
    </article>)}
   </div>
   {shown.length>9&&<button className="crece-more" type="button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>
    {expanded?'Ver menos':`Ver ${shown.length-9} beneficios más`} <ChevronDown className={expanded?'crece-flip':''} size={16}/>
   </button>}
  </section>
  <footer className="crece-footer-note"><ShieldCheck size={19}/><p>Los cobros, comisiones, descuentos, retiros y estados de pago son responsabilidad del backend. Este programa no modifica precios, wallets, permisos, facturas ni condiciones de pedidos anteriores. La tarifa de servicio al cliente estándar es 7 %, informada en checkout.</p></footer>
 </section>;
}

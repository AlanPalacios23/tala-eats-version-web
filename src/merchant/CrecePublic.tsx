import {useState} from 'react';
import {ArrowLeft,ArrowRight,BadgeCheck,Camera,ChartNoAxesCombined,Gift,ShieldCheck,Sparkles,Store,TrendingUp} from 'lucide-react';
import {CRECE_BENEFITS,CRECE_PILLARS,FOUNDERS_OFFER,CRECE_FAQ,founderWhatsAppLink} from './creceContracts';
import CreceCalculator from './CreceCalculator';
import './crece.css';

export default function CrecePublic({onBack}:{onBack:()=>void}){
 const [showAll,setShowAll]=useState(false);
 const contact=founderWhatsAppLink(import.meta.env.VITE_TALA_CRECE_WHATSAPP);
 const initial=CRECE_BENEFITS.filter(b=>b.phase===1);
 const benefits=showAll?CRECE_BENEFITS:initial;
 return <main className="crece-public">
  <header className="crece-public-top"><div className="crece-public-brand"><Store size={25}/><span>Tala <b>Eats</b></span><small>CRECE</small></div><button type="button" onClick={onBack}><ArrowLeft size={18}/> Iniciar sesión</button></header>
  <div className="crece-public-inner">
   <section className="crece-public-hero">
    <span className="crece-overline"><Sparkles size={16}/> TALA EATS CRECE · TALA, JALISCO</span>
    <h1>Tu negocio tiene mucho por crecer. Nosotros te ayudamos.</h1>
    <p>Menú digital, herramientas para recibir pedidos, apoyo para dar a conocer tus productos y asesoría local. Una propuesta creada para los negocios de nuestra ciudad.</p>
    <div className="crece-public-hero-actions">
      {contact&&<a href={contact} target="_blank" rel="noopener noreferrer" className="crece-contact-link">Pedir información por WhatsApp <ArrowRight size={17}/></a>}
      <button type="button" onClick={onBack}>Ya tengo cuenta · Entrar <ArrowRight size={17}/></button>
    </div>
   </section>
   <section className="crece-public-terms" aria-label="Condiciones generales del programa">
    <div><strong>$0</strong><span>Alta y mensualidad fija propuestas</span></div>
    <div><strong>17%</strong><span>Comisión estándar sobre productos vendidos</span></div>
    <div><strong>10</strong><span>Comercios en la primera generación propuesta</span></div>
   </section>
   <section className="crece-public-section"><span className="crece-kicker">LOS 5 PILARES</span><h2>Mucho más que entregas</h2>
    <div className="crece-public-pillars">
     {CRECE_PILLARS.map((p,i)=><article key={p.id}><span>{[<Camera key="a"/>,<Gift key="b"/>,<Store key="c"/>,<ChartNoAxesCombined key="d"/>,<TrendingUp key="e"/>][i]}</span><strong>{p.label}</strong><p>{p.caption}</p></article>)}
    </div>
   </section>
   <section className="crece-public-section"><span className="crece-kicker">FUNDADORES TALA EATS</span><h2>Beneficios especiales para comenzar</h2>
    <div className="crece-public-founder">
     <div><BadgeCheck/><strong>Hasta {FOUNDERS_OFFER.founderPhotoLimit} fotografías</strong><span>Coordinadas por el equipo, conforme a agenda</span></div>
     <div><Gift/><strong>Hasta {FOUNDERS_OFFER.featuredDays} días de visibilidad</strong><span>Según calendario y espacios disponibles</span></div>
     <div><ShieldCheck/><strong>Sin exclusividad obligatoria</strong><span>Tu negocio puede seguir vendiendo por otros canales</span></div>
    </div>
    <p className="crece-public-note">Este paquete aún requiere aprobación y condiciones por escrito. No representa una plaza asignada, ventas garantizadas ni activación inmediata.</p>
   </section>
   <CreceCalculator/>
   <section className="crece-public-section"><span className="crece-kicker">BENEFICIOS</span><h2>Lo que puedes aprovechar</h2>
    <div className="crece-public-benefits">{benefits.map(b=><article key={b.id}><span className={'crece-benefit-status '+b.state}>{b.state==='disponible'?'Disponible en la app':b.state==='asistido'?'Con apoyo del equipo':'En preparación'}</span><h3>{b.title}</h3><p>{b.description}</p></article>)}</div>
    <button className="crece-public-more" type="button" onClick={()=>setShowAll(x=>!x)}>{showAll?'Mostrar solo ventajas del lanzamiento':`Ver los ${CRECE_BENEFITS.length} beneficios y próximas funciones`} <ArrowRight size={16}/></button>
   </section>
   <section className="crece-public-faq" aria-label="Preguntas frecuentes sobre la afiliación">
    <div className="crece-section-heading"><div><span className="crece-kicker">PREGUNTAS FRECUENTES</span>
     <h2>Todo claro, desde el primer día</h2>
     <p>Antes de afiliar tu negocio, conoce las condiciones propuestas y lo que todavía estamos preparando.</p>
    </div></div>
    <div className="crece-public-faq-list">{CRECE_FAQ.map(item=>
     <details key={item.id}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
   </section>
   <footer className="crece-public-bottom"><div><h2>Tú te encargas de tu negocio. Tala Eats te ayuda a crecer.</h2><p>La afiliación se confirma exclusivamente mediante el proceso oficial de Tala Eats. El contacto por WhatsApp solo se abre al elegirlo; esta página no almacena solicitudes ni datos personales.</p></div>{contact?<a className="crece-contact-link" href={contact} target="_blank" rel="noopener noreferrer">Consultar afiliación <ArrowRight size={17}/></a>:<button type="button" onClick={onBack}>Entrar al portal <ArrowRight size={17}/></button>}</footer>
  </div>
 </main>;
}

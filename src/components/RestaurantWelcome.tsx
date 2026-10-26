import {Link} from 'react-router-dom';
import {
 ArrowRight, BadgeCheck, BellRing, Check, ChefHat, ClipboardCheck,
 CreditCard, LayoutDashboard, LockKeyhole, PackageCheck, Settings2,
 ShieldCheck, ShoppingBag, Store, UtensilsCrossed
} from 'lucide-react';
import '../styles/restaurant-welcome.css';

type Props={existingCustomer?:boolean};
const FEATURES=[
 {Icon:ShoppingBag,label:'Pedidos',title:'Cada pedido, bajo control',detail:'Visualiza lo que llega, acepta, prepara y marca como listo desde un tablero pensado para trabajar rápido.'},
 {Icon:UtensilsCrossed,label:'Productos',title:'Tu menú siempre actualizado',detail:'Cambia precios, existencias y disponibilidad sin depender de terceros.'},
 {Icon:Settings2,label:'Operación',title:'Abre cuando estés listo',detail:'Controla tu disponibilidad y la recogida en tienda con la autorización del servidor.'},
 {Icon:CreditCard,label:'Finanzas',title:'Números claros',detail:'Consulta ventas, comisiones y movimientos registrados; sin confundir ingresos con transferencias bancarias.'}
] as const;
const STEPS=[
 {id:'01',title:'Solicita el alta',description:'Crea tu cuenta y registra los datos de tu restaurante.'},
 {id:'02',title:'Validamos tu comercio',description:'Administración revisa la solicitud y activa tus permisos.'},
 {id:'03',title:'Prepara tu negocio',description:'Configura tu menú y confirma tu cuenta Stripe Connect cuando corresponda.'}
] as const;

function MerchantWordmark(){
 return <span className="rb-wordmark">Tala <strong>Eats</strong><span className="rb-wordmark-tag">RESTAURANTES</span></span>;
}
function WorkflowSample(){
 const states=[
  {state:'Nuevos',tone:'amber',title:'Por aceptar',description:'Revisa el pedido entrante',Icon:BellRing},
  {state:'Confirmados',tone:'blue',title:'Aceptado',description:'Prepara los productos',Icon:ClipboardCheck},
  {state:'En cocina',tone:'purple',title:'Preparando',description:'Continúa la preparación',Icon:ChefHat},
  {state:'Listos',tone:'green',title:'Para recoger',description:'Confirma entrega con PIN',Icon:PackageCheck}
 ] as const;
 return <div className="rb-preview" aria-label="Vista ilustrativa del panel de pedidos de Restaurantes">
   <div className="rb-preview-header">
    <span className="rb-preview-mark"><Store size={19}/></span>
    <div><strong>Centro de pedidos</strong><small>Tu espacio de trabajo</small></div>
    <span className="rb-preview-demo">VISTA ILUSTRATIVA</span>
   </div>
   <div className="rb-preview-bar">
    <div><span className="rb-preview-eyebrow">DÍA A DÍA</span><h3>Pedidos de tu negocio</h3></div>
    <span className="rb-preview-refresh"><LayoutDashboard size={15}/> Panel operativo</span>
   </div>
   <div className="rb-preview-grid">
    {states.map(({state,tone,title,description,Icon})=><div className="rb-preview-column" key={state}>
      <div className="rb-preview-column-label"><span className={'rb-preview-dot '+tone}/>{state}</div>
      <div className="rb-preview-ticket"><Icon size={20}/><strong>{title}</strong><small>{description}</small><div className="rb-preview-dashes"><i/><i/></div></div>
    </div>)}
   </div>
   <div className="rb-preview-bottom"><span><ShieldCheck size={15}/> Datos y pagos validados por el backend</span><span>No son pedidos reales</span></div>
 </div>;
}
export function RestaurantWelcome({existingCustomer=false}:Props){
 const registerTo=existingCustomer?'/restaurante/alta':'/restaurante/acceso?mode=register';
 return <div className="rb-welcome" data-restaurant-welcome="true">
  <a className="rb-skip-link" href="#rb-main">Saltar al contenido de Restaurantes</a>
  <header className="rb-header">
   <Link to="/" className="rb-brand-link" aria-label="Volver al selector Tala Eats"><MerchantWordmark/></Link>
   <nav className="rb-header-actions" aria-label="Acciones de Restaurante">
    <Link to="/" className="rb-back">Volver a Tala Eats</Link>
    <Link className="rb-header-access" to={existingCustomer?'/restaurante/alta':'/restaurante/acceso'}>{existingCustomer?'Mi solicitud':'Iniciar sesión'} <ArrowRight size={16}/></Link>
   </nav>
  </header>
  <div id="rb-main">
   <section className="rb-hero">
    <div className="rb-hero-copy">
     <span className="rb-kicker"><span className="rb-kicker-dot"/> TALA EATS PARA NEGOCIOS LOCALES</span>
     <h1>Tu cocina se mueve.<br/><em>Tu negocio crece.</em></h1>
     <p>Una aplicación hecha para restaurantes: recibe pedidos, administra tu menú y prepara cada entrega desde un solo lugar. Sin entrar a la app de clientes.</p>
     {existingCustomer&&<div className="rb-existing"><BadgeCheck size={19}/> Ya tienes una cuenta de Tala Eats. Solicita activar tu restaurante con ella.</div>}
     <div className="rb-hero-actions">
      <Link className="rb-btn rb-btn-primary" to={registerTo}>{existingCustomer?'Solicitar activación':'Registrar mi restaurante'} <ArrowRight size={19}/></Link>
      <Link className="rb-btn rb-btn-secondary" to="/restaurante/acceso">{existingCustomer?'Cambiar de cuenta':'Ya tengo una cuenta'} <ArrowRight size={17}/></Link>
     </div>
     <div className="rb-hero-assurances"><span><Check size={15}/> Control de pedidos</span><span><Check size={15}/> Menú y stock</span><span><Check size={15}/> Activación verificada</span></div>
    </div>
    <div className="rb-hero-demo"><div className="rb-demo-glow" aria-hidden="true"/><WorkflowSample/></div>
   </section>
   <section className="rb-section rb-features" aria-labelledby="rb-features-title">
    <div className="rb-section-heading"><div><span className="rb-section-kicker">TODO EN UN LUGAR</span><h2 id="rb-features-title">Un panel para trabajar, no para complicarte.</h2></div><p>Las herramientas que necesitas desde tu primer pedido.</p></div>
    <div className="rb-feature-grid">{FEATURES.map(({Icon,label,title,detail})=><article className="rb-feature" key={label}>
      <div className="rb-feature-icon"><Icon size={25} strokeWidth={1.8}/></div><span>{label}</span><h3>{title}</h3><p>{detail}</p>
    </article>)}</div>
   </section>
   <section className="rb-activation" aria-labelledby="rb-activation-title">
    <div className="rb-activation-heading"><span className="rb-section-kicker">EMPIEZA CON SEGURIDAD</span><h2 id="rb-activation-title">Activa tu restaurante en tres pasos.</h2><p>Tú solicitas el acceso; administración verifica el negocio. Ninguna cuenta comienza a cobrar automáticamente.</p><Link className="rb-btn rb-btn-primary" to={registerTo}>Comenzar solicitud <ArrowRight size={18}/></Link></div>
    <div className="rb-steps">{STEPS.map(step=><div className="rb-step" key={step.id}><span>{step.id}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></div>)}
     <div className="rb-security"><LockKeyhole size={19}/><span>Los pagos reales requieren aprobación del negocio y confirmación del titular.</span></div>
    </div>
   </section>
   <section className="rb-final-cta" aria-label="Acceso al panel de Restaurantes"><div><span className="rb-section-kicker">TALA EATS RESTAURANTES</span><h2>El siguiente pedido comienza aquí.</h2><p>Una experiencia separada de Pedir comida, conectada a tu comercio.</p></div><Link to="/restaurante/acceso" className="rb-btn rb-btn-light">Entrar a Restaurantes <ArrowRight size={18}/></Link></section>
  </div>
  <footer className="rb-footer"><MerchantWordmark/><span>© Tala Eats · Gestión de restaurantes</span><Link to="/">Volver al selector de aplicaciones</Link></footer>
 </div>;
}

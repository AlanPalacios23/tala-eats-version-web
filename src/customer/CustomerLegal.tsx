import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import './customer-legal.css';

/** Literal sections from Flutter legal_screens.dart (main, Oct 7 2026).
 * Publishing official policy changes requires a separate legal approval.
 */
const terms = [
 ['1. Uso de Tala Eats','Tala Eats permite consultar comercios participantes, seleccionar productos, realizar pedidos y dar seguimiento a su estado. Debes proporcionar información verdadera, mantener segura tu cuenta y utilizar el servicio únicamente para fines lícitos.'],
 ['2. Pedidos y disponibilidad','Los productos, horarios, existencias, zonas de cobertura, tiempos estimados y condiciones de entrega dependen de la disponibilidad informada por cada comercio y de la operación de Tala Eats. El pedido queda sujeto a confirmación del sistema y del comercio correspondiente.'],
 ['3. Precios, cargos y pagos','Antes de confirmar un pedido se mostrará el importe aplicable, incluyendo productos, entrega, propina y cargos o descuentos vigentes. Los pagos electrónicos se procesan mediante proveedores externos autorizados. Tala Eats no debe considerar un pago aprobado hasta recibir confirmación del servidor y del proveedor de pago.'],
 ['4. Cancelaciones y reembolsos','Las posibilidades de cancelar, modificar o reembolsar un pedido dependen del estado del pedido, de la preparación realizada y de las políticas vigentes mostradas al usuario. Cuando corresponda, los reembolsos se tramitarán por el medio y plazo aplicable.'],
 ['5. Entrega y recogida','Debes proporcionar una dirección y ubicación correctas cuando solicites entrega. Para pedidos de recogida, eres responsable de acudir al comercio indicado. Los tiempos mostrados son estimados y pueden variar por demanda, tráfico, clima, operación del comercio u otras circunstancias.'],
 ['6. Promociones y beneficios','Cupones, puntos, recompensas y promociones pueden tener vigencia, disponibilidad, límites y condiciones específicas. Su aplicación final será la que valide el servidor de Tala Eats al procesar el pedido.'],
 ['7. Conducta y seguridad','No está permitido intentar vulnerar el servicio, usar cuentas ajenas, realizar pedidos fraudulentos, abusar de promociones ni utilizar Tala Eats de forma que afecte a comercios, repartidores, usuarios o a la plataforma.'],
 ['8. Disponibilidad del servicio','Tala Eats puede realizar mantenimiento, corregir errores, suspender temporalmente funciones o modificar características cuando sea necesario para seguridad, operación o cumplimiento. Se procurará informar los cambios relevantes cuando corresponda.'],
 ['9. Soporte','Si tienes un problema con tu cuenta, pedido o pago, utiliza los canales de soporte disponibles en la aplicación. Conserva la información del pedido para facilitar la atención.'],
];
const privacy = [
 ['Datos que podemos tratar','Según las funciones que utilices, Tala Eats puede tratar datos de cuenta y contacto, direcciones y ubicación para entrega, información de pedidos, preferencias, comunicaciones de soporte, datos técnicos de seguridad y referencias necesarias para procesar pagos mediante proveedores externos.'],
 ['Finalidades principales','Los datos se utilizan para crear y administrar tu cuenta, autenticarte, procesar y entregar pedidos, calcular cobertura y tarifas, atender soporte, prevenir fraude, proteger la seguridad del servicio, generar comprobaciones operativas y cumplir obligaciones aplicables.'],
 ['Proveedores y comercios','La información estrictamente necesaria puede compartirse con comercios, repartidores, proveedores de pago, infraestructura, mensajería o servicios técnicos que participen en la operación del pedido o de la plataforma, conforme a sus funciones y a la normativa aplicable.'],
 ['Ubicación','Cuando solicites entrega, Tala Eats puede utilizar la dirección o ubicación que autorices para validar cobertura, calcular tarifas y facilitar la entrega. Puedes administrar tus direcciones desde la aplicación y los permisos de ubicación desde Android.'],
 ['Seguridad y conservación','Tala Eats aplica medidas técnicas y organizativas para proteger la información. La sesión móvil se almacena mediante mecanismos seguros del dispositivo. La información se conserva durante el tiempo necesario para las finalidades descritas y para obligaciones legales, de seguridad, prevención de fraude o resolución de disputas.'],
 ['Tus decisiones y derechos','Desde la sección Privacidad puedes administrar preferencias disponibles y solicitar acceso o exportación de tus datos y, cuando proceda, la eliminación de tu cuenta. Algunas obligaciones legales o de seguridad pueden requerir conservar determinada información durante un periodo adicional.'],
 ['Contacto','Para solicitudes relacionadas con privacidad o soporte puedes utilizar la sección Ayuda y soporte de Tala Eats.'],
];
export function CustomerLegal() {
 const location=useLocation();
 const isTerms=location.pathname==='/terminos';
 const sections=isTerms?terms:privacy;
 const title=isTerms?'Términos y Condiciones de Uso':'Aviso de Privacidad';
 return <div className="te-customer te-legal-page te-motion-page">
  <div className="te-legal-inner">
   <Link className="te-panel-back te-legal-back" to="/acceso"><ArrowLeft size={18}/>Volver</Link>
   <div className="te-legal-icon"><FileText size={23}/></div>
   <h1>{title}</h1><p className="te-legal-date">Última actualización: 7 de octubre de 2026</p>
   {sections.map(([heading,body])=><section key={heading} className="te-legal-section">
    <h2>{heading}</h2><p>{body}</p>
   </section>)}
  </div>
 </div>;
}

/**
 * Tala Eats Crece — merchant value proposition, pilot 2026.
 * This is an honest feature/benefit inventory, NOT an entitlement API.
 * Financial terms are informative; the backend owns each order's contract.
 */
export type CrecePillar = 'identidad'|'visibilidad'|'operacion'|'finanzas'|'crecimiento';
export type BenefitState = 'disponible'|'asistido'|'planeado';
export type CreceBenefit = Readonly<{
  id:string;title:string;description:string;pillar:CrecePillar;
  state:BenefitState;phase:1|2|3;
}>;
export const CRECE_PILLARS:ReadonlyArray<{id:CrecePillar;label:string;caption:string}>=[
  {id:'identidad',label:'Tu marca',caption:'Presencia digital profesional'},
  {id:'visibilidad',label:'Más visibilidad',caption:'Que te descubran en Tala'},
  {id:'operacion',label:'Control de tu negocio',caption:'Herramientas que ahorran tiempo'},
  {id:'finanzas',label:'Dinero claro',caption:'Movimientos y costos verificables'},
  {id:'crecimiento',label:'Tala Eats Crece',caption:'Mejoras constantes para vender mejor'}
];
export const CRECE_BENEFITS:readonly CreceBenefit[]=Object.freeze([
  {id:'alta',title:'Alta y catálogo sin costo',description:'Configurar una tienda y registrar su menú, sujeto a aprobación.',pillar:'identidad',state:'asistido',phase:1},
  {id:'fotos',title:'Fotografías de productos',description:'Hasta 10 fotografías para Fundadores, mediante cita y disponibilidad.',pillar:'identidad',state:'asistido',phase:1},
  {id:'perfil',title:'Perfil público de comercio',description:'Tu tienda y productos visibles cuando el backend autoriza su publicación.',pillar:'identidad',state:'disponible',phase:1},
  {id:'qr',title:'QR y enlace compartible',description:'Comparte tu catálogo público con un QR generado localmente desde la app.',pillar:'identidad',state:'disponible',phase:1},
  {id:'kit',title:'Kit de lanzamiento',description:'Textos, sugerencias y material promocional para tu negocio.',pillar:'identidad',state:'asistido',phase:1},
  {id:'destacado',title:'Visibilidad Fundadores',description:'Hasta 30 días promocionales, una vez validada la disponibilidad de espacios.',pillar:'visibilidad',state:'asistido',phase:1},
  {id:'redes',title:'Difusión en redes locales',description:'Contenido en redes de Tala Eats, conforme a calendario y autorización.',pillar:'visibilidad',state:'asistido',phase:1},
  {id:'whatsapp',title:'Compartir por WhatsApp',description:'Enlace de tu tienda que puedes compartir en conversaciones.',pillar:'visibilidad',state:'disponible',phase:1},
  {id:'instagram',title:'Enlace en biografía',description:'Utiliza tu tienda como destino desde tus redes sociales.',pillar:'visibilidad',state:'disponible',phase:1},
  {id:'cupones',title:'Cupones y campañas',description:'Campañas controladas y descuentos con reglas del backend.',pillar:'visibilidad',state:'planeado',phase:2},
  {id:'temporadas',title:'Campañas de temporada',description:'Apoyos para fines de semana y fechas especiales.',pillar:'visibilidad',state:'planeado',phase:2},
  {id:'pedidos',title:'Tablero de pedidos',description:'Revisa y administra órdenes confirmadas por tu servidor.',pillar:'operacion',state:'disponible',phase:1},
  {id:'inventario',title:'Menú, precios y existencias',description:'Actualiza productos y consulta su disponibilidad real.',pillar:'operacion',state:'disponible',phase:1},
  {id:'pausa',title:'Abrir y cerrar tu tienda',description:'Controla disponibilidad, sujeto a las reglas de tu backend.',pillar:'operacion',state:'disponible',phase:1},
  {id:'cocina',title:'Estado de preparación',description:'Marca pedidos aceptados, en preparación y listos.',pillar:'operacion',state:'disponible',phase:1},
  {id:'programados',title:'Pedidos programados',description:'Aceptar órdenes para ventanas futuras con capacidad validada.',pillar:'operacion',state:'planeado',phase:2},
  {id:'combos',title:'Combos y paquetes',description:'Promociones de varios productos con precio versionado.',pillar:'operacion',state:'planeado',phase:2},
  {id:'sucursales',title:'Varias sucursales',description:'Visión central de diferentes sucursales para negocios que crecen.',pillar:'operacion',state:'planeado',phase:3},
  {id:'reporte',title:'Rendimiento histórico',description:'Consulta pedidos y ventas que devuelve la API de tu comercio.',pillar:'finanzas',state:'disponible',phase:1},
  {id:'exportar',title:'Exportar vista de pedidos',description:'Descarga los pedidos visibles sin datos sensibles de entrega.',pillar:'finanzas',state:'disponible',phase:1},
  {id:'wallet',title:'Wallet de consulta',description:'Revisa únicamente cifras y estados confirmados por el servidor.',pillar:'finanzas',state:'disponible',phase:1},
  {id:'comisiones',title:'Comisiones transparentes',description:'17% estándar sobre productos; políticas históricas se conservan por pedido.',pillar:'finanzas',state:'asistido',phase:1},
  {id:'soporte',title:'Acompañamiento local',description:'Capacitación y orientación durante el piloto.',pillar:'crecimiento',state:'asistido',phase:1},
  {id:'ideas',title:'Consejos según tus datos',description:'Recomendaciones solo cuando existen datos verificables de la API.',pillar:'crecimiento',state:'disponible',phase:1},
  {id:'fidelidad',title:'Clientes frecuentes y puntos',description:'Programa de recompensas con consentimiento y condiciones.',pillar:'crecimiento',state:'planeado',phase:3},
  {id:'empresas',title:'Pedidos para oficinas y eventos',description:'Compras de mayor volumen con preparación coordinada.',pillar:'crecimiento',state:'planeado',phase:3},
  {id:'calidad',title:'Reconocimientos de calidad',description:'Distinciones con métricas verificables, no reseñas inventadas.',pillar:'crecimiento',state:'planeado',phase:3}
]);

export const FOUNDERS_OFFER=Object.freeze({
 cohort:'Fundadores Tala Eats',city:'Tala, Jalisco',capacity:10,
 onboardingFeeMinor:0,monthlyFeeMinor:0,merchantCommissionBps:1700,
 customerServiceBps:700,founderPhotoLimit:10,featuredDays:30,
 mandatoryExclusivity:false,guaranteedSales:false
});

export type CreceMetrics={orders:number;delivered:number;inventory_low:number};
export type CreceAdvice={id:string;title:string;detail:string;target:'pedidos'|'menu'|'rendimiento'};
export function creceAdvice(metrics:CreceMetrics|null):readonly CreceAdvice[]{
 if(!metrics || !Number.isSafeInteger(metrics.orders)||metrics.orders<0||
  !Number.isSafeInteger(metrics.delivered)||metrics.delivered<0||
  metrics.delivered>metrics.orders||!Number.isSafeInteger(metrics.inventory_low)||
  metrics.inventory_low<0)return [];
 const result:CreceAdvice[]=[];
 if(metrics.inventory_low>0)result.push({id:'stock',title:'Revisa productos con poco stock',
  detail:`La API reporta ${metrics.inventory_low} productos con inventario bajo.`,target:'menu'});
 if(metrics.orders===0)result.push({id:'primeros',title:'Prepara tu primera venta',
  detail:'Completa fotos, precios y disponibilidad antes de difundir tu tienda.',target:'menu'});
 else if(metrics.delivered<metrics.orders)result.push({id:'pedidos',title:'Revisa el estado de tus pedidos',
  detail:'El histórico incluye órdenes no entregadas. Consulta sus estados antes de sacar conclusiones.',target:'pedidos'});
 else result.push({id:'consistencia',title:'Mantén tu atención constante',
  detail:'Tus pedidos históricos aparecen como entregados. Continúa revisando el tablero.',target:'rendimiento'});
 return result;
}
export function storefrontLink(id:unknown,customerBase:unknown):string|null{
 if(!Number.isSafeInteger(id)||Number(id)<=0||typeof customerBase!=='string'||
  !customerBase.trim())return null;
 try{
  const url=new URL(customerBase);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||
     url.pathname!=='/'||!url.hostname)return null;
  return new URL('/comercio/'+id,url.origin).toString();
 }catch{return null;}
}

/** The configured hostname by itself does NOT prove that a merchant
 * actually appears in the customer catalog. These must be TWO independent
 * public API reads from the existing backend, never self-reported fields.
 */
export function verifiedPublicStorefront(
 owner:{id:number}|null,list:unknown,detail:unknown
):boolean{
 if(!owner||!Number.isSafeInteger(owner.id)||owner.id<=0||
  !Array.isArray(list)||!detail||typeof detail!=='object'||
  Array.isArray(detail))return false;
 const matchesId=(value:unknown):boolean=>(
  Boolean(value)&&typeof value==='object'&&!Array.isArray(value)&&
  (value as {id?:unknown}).id===owner.id
 );
 const actual=detail as {id?:unknown;name?:unknown};
 return list.some(matchesId)&&matchesId(actual)&&
  typeof actual.name==='string'&&actual.name.trim().length>=2;
}

export type CreceReadinessStep=Readonly<{
 id:string;title:string;description:string;done:boolean;
 target:'menu'|'negocio'|'crece';
}>;
/** Profile completeness is informational, NOT an operational GO or
 * verified payment / published restaurant approval.
 */
export function merchantProfileChecklist(owner:{
 id:number;name:string;address?:string;
 verification_status?:string;cover_image_url?:string|null;
 menu_items?:ReadonlyArray<{
  is_available:boolean;stock:number
 }>
}|null,publicVerified:boolean):readonly CreceReadinessStep[]{
 if(!owner||!Number.isSafeInteger(owner.id)||owner.id<=0)return [];
 return [
  {id:'profile',title:'Identidad del comercio',
   description:'Nombre y ficha del comercio disponibles desde el servidor.',
   done:typeof owner.name==='string'&&owner.name.trim().length>=2,
   target:'negocio'},
  {id:'address',title:'Dirección de referencia',
   description:'Revisa que la dirección mostrada sea correcta y actualizada.',
   done:typeof owner.address==='string'&&owner.address.trim().length>=5,
   target:'negocio'},
  {id:'menu',title:'Productos listos para mostrar',
   description:'Al menos un artículo disponible con existencias confirmadas.',
   done:Array.isArray(owner.menu_items)&&owner.menu_items.some(p=>
    p.is_available===true&&Number.isSafeInteger(p.stock)&&p.stock>0),
   target:'menu'},
  {id:'image',title:'Imagen de portada',
   description:'Agrega una imagen propia o autorizada de tu establecimiento.',
   done:typeof owner.cover_image_url==='string'&&
    /^https:\/\//.test(owner.cover_image_url),
   target:'negocio'},
  {id:'publication',title:'Publicación comprobada',
   description:'Tu tienda debe aparecer en el catálogo y abrir desde su detalle público.',
   done:publicVerified,target:'crece'}
 ];
}

import {CRECE_BENEFITS,type CreceBenefit} from './creceContracts';
import type {MenuItem} from '../lib/types';

/** Feature catalog is deliberately a real action map, not 27 inert badges.
 * Draft exports are NOT customer-facing campaigns/orders or persisted offers.
 * Merchant must submit operations through backend gates after release.
 */
export type CreceAction=
 | {kind:'navigate';destination:'negocio'|'menu'|'pedidos'|'rendimiento'|'wallet';label:string}
 | {kind:'section';destination:'crece-share'|'crece-recommend'|'crece-calculator';label:string}
 | {kind:'assisted';label:string}
 | {kind:'share';label:string}
 | {kind:'draft';label:string};

const navigate=(destination:Extract<CreceAction,{kind:'navigate'}>['destination']):CreceAction=>
 ({kind:'navigate',destination,label:destination==='menu'?'Abrir menú':destination==='pedidos'?'Abrir pedidos':destination==='wallet'?'Consultar wallet':destination==='rendimiento'?'Ver rendimiento':'Ir a mi negocio'});
export const CRECE_ACTIONS:Readonly<Record<CreceBenefit['id'],CreceAction>>=Object.freeze({
 alta:{kind:'assisted',label:'Solicitar ayuda de configuración'},
 fotos:{kind:'assisted',label:'Solicitar sesión de fotos'},
 perfil:navigate('negocio'),
 qr:{kind:'section',destination:'crece-share',label:'Ir a mi QR'},
 kit:{kind:'draft',label:'Guardar kit de difusión'},
 destacado:{kind:'assisted',label:'Consultar visibilidad del piloto'},
 redes:{kind:'assisted',label:'Solicitar apoyo en redes'},
 whatsapp:{kind:'share',label:'Preparar enlace para WhatsApp'},
 instagram:{kind:'share',label:'Copiar enlace para Instagram'},
 cupones:{kind:'draft',label:'Preparar borrador de cupón'},
 temporadas:{kind:'draft',label:'Preparar campaña estacional'},
 pedidos:navigate('pedidos'),
 inventario:navigate('menu'),
 pausa:navigate('negocio'),
 cocina:navigate('pedidos'),
 programados:{kind:'draft',label:'Preparar pedido programado'},
 combos:{kind:'draft',label:'Diseñar combo de productos'},
 sucursales:{kind:'draft',label:'Planificar nueva sucursal'},
 reporte:navigate('rendimiento'),
 exportar:navigate('pedidos'),
 wallet:navigate('wallet'),
 comisiones:{kind:'section',destination:'crece-calculator',label:'Ver simulador de comisión'},
 soporte:{kind:'assisted',label:'Solicitar orientación local'},
 ideas:{kind:'section',destination:'crece-recommend',label:'Ver recomendaciones reales'},
 fidelidad:{kind:'draft',label:'Diseñar programa de recompensas'},
 empresas:{kind:'draft',label:'Preparar propuesta para empresas'},
 calidad:{kind:'draft',label:'Revisar requisitos de calidad'}
});
export const ASSISTED_BENEFITS=Object.freeze([
 'alta','fotos','destacado','redes','comisiones','soporte'
]); // Also: kit is generated locally AND can be requested as human support.
export function unassignedCreceActions(){
 return CRECE_BENEFITS.filter(b=>!Object.hasOwn(CRECE_ACTIONS,b.id));
}
export function officialAssistanceLink(
 rawPhone:unknown,benefitId:string,storeName:unknown
):string|null{
 if(typeof rawPhone!=='string'||!/^[1-9]\d{9,14}$/.test(rawPhone))return null;
 const benefit=CRECE_BENEFITS.find(x=>x.id===benefitId);
 if(!benefit)return null;
 const name=typeof storeName==='string'?
  storeName.replace(/[\r\n\t]/g,' ').trim().slice(0,90):'';
 const message='Hola, soy responsable de '+(name||'un negocio')+
  '. Quisiera información para solicitar "'+benefit.title+
  '" en Tala Eats Crece. Entiendo que requiere confirmación del equipo.';
 return 'https://wa.me/'+rawPhone+'?text='+encodeURIComponent(message);
}

export function creceDraftText(input:{
 benefitId:string;storeName:string;storeId:number;
 menu?:readonly MenuItem[];storefrontUrl?:string|null;
}):string|null{
 const benefit=CRECE_BENEFITS.find(x=>x.id===input.benefitId);
 if(!benefit||(!['kit','cupones','temporadas','programados','combos',
  'sucursales','fidelidad','empresas','calidad'].includes(benefit.id))||
  !Number.isSafeInteger(input.storeId)||input.storeId<=0)return null;
 const name=input.storeName.replace(/[\r\n\t]/g,' ').trim().slice(0,100);
 if(name.length<2)return null;
 const productNames=(input.menu??[]).filter(m=>
  typeof m.name==='string'&&m.name.trim()&&m.is_available===true)
  .slice(0,8).map(m=>'- '+m.name.replace(/[\r\n\t]/g,' ').slice(0,100));
 const examples:Record<string,string[]>={
  kit:['Texto para redes sociales:','Conoce '+name+' en Tala Eats.',
   input.storefrontUrl?'Nuestro menú: '+input.storefrontUrl:
   'Enlace público no verificado; agregarlo después de revisar publicación.',
   'Usar solo fotografías de las que tengamos permiso.'],
  cupones:['Definir código, porcentaje o monto en pesos y caducidad.',
   'Definir quién financia el descuento y cuántos usos permite.',
   'No publicar hasta contar con backend de cupones, reembolso y autorización.'],
  temporadas:['Definir fecha, inventario, responsable y presupuesto de difusión.',
   'Aprobar el material antes de enviarlo. No hay campaña activada.'],
  programados:['Definir fecha/hora, capacidad de cocina y reglas de cancelación.',
   'Requiere reserva real de inventario, cotización y control de pagos.'],
  combos:['Seleccionar productos, cantidades y precio final.',
   'Validar stock del conjunto antes de ofrecerlo en checkout.'],
  sucursales:['Verificar dirección, horarios, responsable y catálogo por sucursal.',
   'Las sucursales reales se crean con autorización y M6, no desde este borrador.'],
  fidelidad:['Definir criterios de acumulación, caducidad y límites de puntos.',
   'Requiere consentimiento y libro de puntos antifraude para activar.'],
  empresas:['Definir tamaño del pedido, ventana de entrega, anticipo y responsable.',
   'La cotización real, impuestos y pago deben confirmarse en backend.'],
  calidad:['Definir métricas con periodo, mínimo de pedidos y evidencias reales.',
   'No mostrar distintivos al público sin verificación y aprobación.']
 };
 const result=['TALA EATS CRECE · BORRADOR DE TRABAJO',
  'Comercio: '+name,'ID de referencia: '+input.storeId,
  'Herramienta: '+benefit.title,
  'ESTADO: NO PUBLICADO / NO ACTIVA PEDIDOS, DESCUENTOS NI PAGOS','',
  ...examples[benefit.id],
  ...(productNames.length?['','Productos disponibles (captura informativa):',
   ...productNames]:[]),'',
  'Preparado localmente en la PWA. Requiere revisión y aprobación operativa.',
  'Este archivo no representa un acuerdo comercial ni garantía de ventas.'];
 return result.join('\n')+'\n';
}

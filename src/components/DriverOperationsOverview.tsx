import {CheckCircle2,Info,ShieldCheck,WifiOff} from 'lucide-react';
import type {DriverPresenceReadiness} from '../lib/driver-presence';

type Props={
 readiness:DriverPresenceReadiness|null;
 offline:boolean;
 hasActive:boolean;
 offersError:boolean;
 dashboardError:boolean;
};
/** A read-only diagnostic of authoritative backend flags. Does not change
 * availability, location or payments, and never infers dispatch from UI flags.
 */
export function DriverOperationsOverview({readiness,offline,hasActive,offersError,dashboardError}:Props){
 const verified=readiness?.admin_verified===true;
 const online=readiness?.online===true&&readiness?.presence_enabled===true;
 const fresh=readiness?.fresh_gps===true;
 const dispatch=readiness?.ready_for_dispatch===true&&verified&&online&&fresh;
 const data=[
  {name:'Cuenta',value:!readiness?'Sin verificar':verified?'Aprobada':'Pendiente'},
  {name:'Ubicación',value:!readiness?'Sin verificar':fresh?'GPS vigente':'GPS pendiente'},
  {name:'Nuevos pedidos',value:!readiness?'Sin verificar':dispatch&&!offline?'Autorizados':'No autorizados'},
  {name:'Datos de jornada',value:dashboardError?'Sin actualizar':'Consulta disponible'},
 ];
 return <section className="df-section df-operational-overview" aria-label="Estado operativo del repartidor">
  <div className="df-section-title"><h2>Estado operativo</h2><span className="df-operational-readonly"><ShieldCheck size={14} aria-hidden="true"/> Solo lectura</span></div>
  <div className="df-surface df-operational-panel">
   <div className="df-operational-head">
    {offline?<WifiOff size={19} aria-hidden="true"/>:<Info size={19} aria-hidden="true"/>}
    <span>{offline?'Dispositivo sin conexión':hasActive?'Entrega asignada en curso':online?'Disponibilidad confirmada por el servidor':'Fuera de línea o pendiente de sincronización'}</span>
   </div>
   <div className="df-operational-grid">
    {data.map(x=><div key={x.name} className="df-operational-entry">
     <small>{x.name}</small><strong>{x.value}</strong>
    </div>)}
   </div>
   {offersError&&<p className="df-operational-warning" role="status"><WifiOff size={15} aria-hidden="true"/> Última consulta de ofertas fallida; revisa tu conexión antes de aceptar pedidos.</p>}
   {hasActive&&<p className="df-operational-warning"><CheckCircle2 size={15} aria-hidden="true"/> Las entregas activas se confirman únicamente desde el servidor y requieren sus propios permisos.</p>}
   <p className="df-operational-caption">Tu ubicación no se guarda en esta vista. El GPS vigente no garantiza que el servidor permita nuevas asignaciones.</p>
  </div>
 </section>;
}

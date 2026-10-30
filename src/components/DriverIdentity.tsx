import {Bike} from 'lucide-react';
import {trustedDriverAvatarUrl} from '../lib/driver-avatar';
import type {Order} from '../lib/types';
import '../styles/driver-avatar-rc144.css';

/** Only render data attached to a backend-authorized ASSIGNED order; no global
 * driver directory and no pre-assignment identity disclosures. */
export function DriverIdentity({order}:{order:Order}){
 const d=order.driver_info;
 if(order.order_type!=='delivery'||!d||!Number.isSafeInteger(d.id)||d.id<=0||
    !['assigned','picked_up','on_the_way','delivered'].includes(order.status))
  return null;
 const img=trustedDriverAvatarUrl(d.avatar_url);
 const name=typeof d.name==='string'&&d.name.length<=120?d.name:'Repartidor asignado';
 return <section className="te-driver-identity" aria-label="Repartidor asignado">
  <div className="te-driver-portrait">{img?<img loading="lazy" decoding="async" referrerPolicy="no-referrer"
   src={img} alt={'Foto de '+name}/>:<Bike size={24} aria-hidden="true"/>}</div>
  <div className="te-driver-copy"><strong>{name}</strong><span>{d.vehicle||'Repartidor'} · Asignado a este pedido</span></div>
 </section>;
}

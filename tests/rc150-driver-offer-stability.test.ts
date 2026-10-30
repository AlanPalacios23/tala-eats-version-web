import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {driverOfferPickupDirectionsHref,selectedDriverOffer,sortDriverOffers} from '../src/lib/driver-offer-choice';
import type {DriverOfferMarker} from '../src/lib/driver-live-map';
import type {Order} from '../src/lib/types';

const map=readFileSync(new URL('../src/components/DriverLiveMap.tsx',import.meta.url),'utf8');
const style=readFileSync(new URL('../src/styles/driver-offer-stability-rc150.css',import.meta.url),'utf8');
const o=(id:number,earning:string):Order=>({
 id,restaurant_id:id+100,status:'ready',order_type:'delivery',
 payment_method:'cash',payment_status:'pending',total:'200',created_at:'2026-10-30T22:00:00',items:[],driver_earning:earning
});
const a=o(1,'32.00'),b=o(2,'50.00'),c=o(3,'45.00');
const loc={lat:20.60123,lng:-103.70987};
const marker:DriverOfferMarker={order:a,point:loc,name:'Comercio confirmado',source:'offer'};

describe('RC150 — selección estable, GPS real y recogida',()=>{
 it('conserva la selección personal mientras cambia el orden por GPS',()=>{
  const incoming=[a,b,c];
  const sorted=sortDriverOffers(incoming,'earnings',[marker],loc);
  expect(sorted.map(x=>x.id)).toEqual([2,3,1]);
  expect(selectedDriverOffer(sorted,1)?.id).toBe(1);
  expect(selectedDriverOffer(sorted,77)?.id).toBe(2);
  expect(selectedDriverOffer([],1)).toBeNull();
  expect(selectedDriverOffer([c,a],null)?.id).toBe(3);
 });
 it('construye solo un enlace de recogida real, sin GPS del mensajero ni dirección del cliente',()=>{
  expect(driverOfferPickupDirectionsHref(marker))
   .toBe('https://www.google.com/maps/dir/?api=1&destination=20.60123%2C-103.70987');
  expect(driverOfferPickupDirectionsHref(null)).toBeNull();
  expect(driverOfferPickupDirectionsHref({...marker,point:{lat:0,lng:0}})).toBeNull();
  expect(driverOfferPickupDirectionsHref({...marker,point:{lat:99,lng:45}})).toBeNull();
  expect(driverOfferPickupDirectionsHref({...marker,point:{lat:Number.NaN,lng:45}})).toBeNull();
 });
 it('al cambiar filtro selecciona explícitamente su primera oferta, luego respeta la selección',()=>{
  expect(map).toContain('const selected=selectedDriverOffer(sortedOffers,selectedId);');
  expect(map).toContain('const next=sortDriverOffers(readyOffers,item.key,markers,position)');
  expect(map).toContain('setSelectedId(next[0]?.id??null)');
  expect(map).toContain('const pickupDirectionsHref=driverOfferPickupDirectionsHref(selectedMarker)');
  expect(map).toContain('href={pickupDirectionsHref} target="_blank" rel="noopener noreferrer"');
  expect(map).toContain("onClick={()=>onAccept(selected)}");
 });
 it('no muestra buscando pedidos ni conserva ubicación azul si no tiene red o GPS vigente',()=>{
  expect(map).toContain('{eligible&&!offline&&!readyOffers.length&&<div className="dm-none">');
  expect(map).toContain("setGpsError('Esperando una ubicación GPS precisa y reciente.');setPosition(null);return;");
  expect(map).toContain("const readyOffers=useMemo(()=>availableMapOffers(offers,dismissed,eligible&&!offline)");
  expect(map).toContain('navigator.geolocation.clearWatch(watchId)');
  expect(map).toContain("document.visibilityState!=='visible'");
  expect(map).not.toContain('api.driverLocation(');
  expect(map).not.toContain('api.driverReject(');
 });
 it('conserva 42px táctiles, diseño acotado a repartidor y movimiento reducido',()=>{
  expect(map).toContain("import '../styles/driver-offer-stability-rc150.css'");
  expect(style).toContain('.dm-immersive .dm-pickup-directions');
  expect(style).toContain('min-height:42px');
  expect(style).toContain('@media(max-width:370px)');
  expect(style).toContain('@media(prefers-reduced-motion:reduce)');
  expect(style).toContain('.dm-immersive .dm-pickup-directions:focus-visible');
 });
});

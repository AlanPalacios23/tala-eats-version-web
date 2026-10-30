import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {canSortOffersByProximity,sortDriverOffers} from '../src/lib/driver-offer-choice';
import type {DriverOfferMarker} from '../src/lib/driver-live-map';
import type {Order} from '../src/lib/types';

const mapSource=readFileSync(new URL('../src/components/DriverLiveMap.tsx',import.meta.url),'utf8');
const style=readFileSync(new URL('../src/styles/driver-offer-choice-rc149.css',import.meta.url),'utf8');
const makeOffer=(id:number,earning?:string):Order=>({
 id,restaurant_id:100+id,status:'ready',order_type:'delivery',
 payment_method:'cash',payment_status:'pending',total:'149.00',
 created_at:'2026-10-30T12:00:00',items:[],driver_earning:earning,
});
const one=makeOffer(1,'32.00'),two=makeOffer(2,'45.50'),three=makeOffer(3);
const offers=[one,two,three];
const markers:DriverOfferMarker[]=[
 {order:one,point:{lat:20.6001,lng:-103.701},name:'Comercio A',source:'catalog'},
 {order:two,point:{lat:20.65,lng:-103.75},name:'Comercio B',source:'catalog'},
];
const gps={lat:20.6002,lng:-103.701};

describe('RC149 — elección responsable de ofertas sobre el mapa',()=>{
 it('conserva el orden del backend por defecto sin mutar la lista',()=>{
  const sorted=sortDriverOffers(offers,'received',markers,gps);
  expect(sorted.map(o=>o.id)).toEqual([1,2,3]);
  expect(sorted).not.toBe(offers);
  expect(offers.map(o=>o.id)).toEqual([1,2,3]);
 });
 it('ordena ganancias reales y deja los importes no confirmados al final',()=>{
  expect(sortDriverOffers(offers,'earnings',markers,gps).map(o=>o.id)).toEqual([2,1,3]);
  const invalid=[
   makeOffer(6,'Infinity'),makeOffer(7,'-8'),makeOffer(8,'1e100'),
   makeOffer(9,'cincuenta'),makeOffer(10,'')
  ];
  expect(sortDriverOffers([invalid[0],one,...invalid.slice(1)],'earnings',markers,gps).map(o=>o.id))
   .toEqual([1,6,7,8,9,10]);
  expect(sortDriverOffers([one,makeOffer(11,'32.00')],'earnings',markers,gps).map(o=>o.id))
   .toEqual([1,11]);
 });
 it('ordena por distancia geodésica de puntos públicos y no inventa distancias',()=>{
  expect(canSortOffersByProximity(gps,markers)).toBe(true);
  expect(sortDriverOffers([two,three,one],'nearby',markers,gps).map(o=>o.id)).toEqual([1,2,3]);
  expect(canSortOffersByProximity(null,markers)).toBe(false);
  expect(canSortOffersByProximity(gps,[])).toBe(false);
  expect(sortDriverOffers([two,one],'nearby',markers,null).map(o=>o.id)).toEqual([2,1]);
  expect(sortDriverOffers([two,one],'nearby',[],gps).map(o=>o.id)).toEqual([2,1]);
 });
 it('presenta controles accesibles en el mapa sin generar pedidos ni tocar el backend',()=>{
  expect(mapSource).toContain("const [offerOrder,setOfferOrder]=useState<DriverOfferOrder>('received')");
  expect(mapSource).toContain("const readyOffers=useMemo(()=>availableMapOffers(offers,dismissed,eligible&&!offline)");
  expect(mapSource).toContain("sortDriverOffers(readyOffers,effectiveOfferOrder,markers,position)");
  expect(mapSource).toContain('role="group" aria-label="Ordenar pedidos disponibles"');
  expect(mapSource).toContain('aria-pressed={effectiveOfferOrder===item.key}');
  expect(mapSource).toContain("disabled={item.key==='nearby'&&!canSortNearby}");
  expect(mapSource).toContain('sortedOffers.filter(o=>o.id!==selected?.id)');
  expect(mapSource).toContain('no la rechaza en el servidor');
  expect(mapSource).not.toContain('localStorage.setItem');
  expect(mapSource).not.toContain('api.driverReject(');
  expect(mapSource).not.toContain('estimatedMinutes');
  expect(mapSource).not.toContain('customer.address');
 });
 it('mantiene el tamaño táctil, foco visible y motion-reduce en la UI',()=>{
  expect(mapSource).toContain("import '../styles/driver-offer-choice-rc149.css'");
  expect(style).toContain('min-height:40px');
  expect(style).toContain('@media(max-width:370px)');
  expect(style).toContain('@media(prefers-reduced-motion:reduce)');
  expect(style).toContain('.dm-immersive .dm-offer-sort-option');
 });
});

import {describe,it,expect,vi,afterEach} from 'vitest';
import {currentDriverPosition,DRIVER_GPS_HEARTBEAT_MS,verifiedOnlinePresence,driverActionsAvailable,driverCanProgressExistingDelivery,validDriverCoordinates} from '../src/lib/driver-presence';
import type {DriverPresenceReadiness} from '../src/lib/driver-presence';

const online:DriverPresenceReadiness={
 environment:'production',presence_enabled:true,admin_verified:true,
 online:true,fresh_gps:true,ready_for_dispatch:false,
 live_delivery_checkout_enabled:false,live_stripe_delivery_enabled:false,
};
afterEach(()=>vi.restoreAllMocks());
describe('RC9.5 web driver presence',()=>{
 it('never confuses LIVE GPS presence with permission to dispatch or charge',()=>{
  expect(verifiedOnlinePresence(online)).toBe(true);
  expect(driverActionsAvailable(online,true)).toBe(false);
  // In LIVE the backend response, not a stale Vite build constant,
  // enables actions once dispatch is independently released.
  expect(driverActionsAvailable({...online,ready_for_dispatch:true},false)).toBe(true);
  expect(driverActionsAvailable({...online,ready_for_dispatch:true},true)).toBe(true);
  for(const unsafe of [
   {...online,admin_verified:false},
   {...online,online:false},
   {...online,fresh_gps:false},
   {...online,presence_enabled:false},
  ])expect(verifiedOnlinePresence(unsafe)).toBe(false);
  expect(verifiedOnlinePresence(null)).toBe(false);
 });
 it('LIVE delivery: backend release enables new jobs and existing PIN handoff survives GPS outage',()=>{
  const released={...online,live_delivery_checkout_enabled:true,
    ready_for_dispatch:true};
  expect(driverActionsAvailable(released,false)).toBe(true);
  expect(driverCanProgressExistingDelivery(released,false)).toBe(true);
  const lostGps={...released,fresh_gps:false,ready_for_dispatch:false};
  expect(driverActionsAvailable(lostGps,false)).toBe(false);
  expect(driverCanProgressExistingDelivery(lostGps,false)).toBe(true);
  expect(driverCanProgressExistingDelivery({...lostGps,live_delivery_checkout_enabled:false},true)).toBe(false);
  expect(driverCanProgressExistingDelivery({...lostGps,admin_verified:false},true)).toBe(false);
  expect(driverCanProgressExistingDelivery({...lostGps,online:false},true)).toBe(false);
  expect(driverCanProgressExistingDelivery({...lostGps,presence_enabled:false},true)).toBe(false);
  expect(driverCanProgressExistingDelivery(null,true)).toBe(false);
 });
 it('an assigned staging order can progress to PIN if GPS temporarily expires, but cannot accept NEW work',()=>{
  const stale={...online,environment:'staging' as const,fresh_gps:false,ready_for_dispatch:false};
  expect(driverActionsAvailable(stale,true)).toBe(false);
  expect(driverCanProgressExistingDelivery(stale,true)).toBe(true);
  expect(driverCanProgressExistingDelivery({...stale,online:false},true)).toBe(false);
  expect(driverCanProgressExistingDelivery({...stale,admin_verified:false},true)).toBe(false);
  expect(driverCanProgressExistingDelivery({...stale,environment:'production'},true)).toBe(false);
  expect(driverCanProgressExistingDelivery(stale,false)).toBe(false);
 });
 it('heartbeats before the backend TTL of 120s, only valid coordinates',()=>{
  expect(DRIVER_GPS_HEARTBEAT_MS).toBe(45000);
  expect(DRIVER_GPS_HEARTBEAT_MS).toBeLessThan(120000);
  expect(validDriverCoordinates({lat:20.653,lng:-103.7})).toBe(true);
  expect(validDriverCoordinates({lat:100,lng:-103.7})).toBe(false);
  expect(validDriverCoordinates({lat:20,lng:Infinity})).toBe(false);
 });
 it('requires real fresh high accuracy browser position, never a fixed Tala coordinate',async()=>{
  const now=Date.parse('2026-10-28T20:00:00Z');
  vi.spyOn(Date,'now').mockReturnValue(now);
  const fake={
   getCurrentPosition:(success:PositionCallback,_error:PositionErrorCallback,opts?:PositionOptions)=>{
    expect(opts?.enableHighAccuracy).toBe(true);
    expect(opts?.maximumAge).toBe(0);
    success({timestamp:now,coords:{latitude:20.653,longitude:-103.7,accuracy:12}} as GeolocationPosition);
   },
  };
  expect(await currentDriverPosition(fake)).toEqual({lat:20.653,lng:-103.7});
 });
 it('rejects stale position even when coordinates are plausible',async()=>{
  const now=Date.parse('2026-10-28T20:00:00Z');
  vi.spyOn(Date,'now').mockReturnValue(now);
  const stale={
   getCurrentPosition:(ok:PositionCallback)=>ok({timestamp:now-121000,coords:{
    latitude:20.653,longitude:-103.7,accuracy:12}} as GeolocationPosition),
  };
  await expect(currentDriverPosition(stale)).rejects.toThrow(/desactualizada/);
  const imprecise={
   getCurrentPosition:(ok:PositionCallback)=>ok({timestamp:now,coords:{
    latitude:20.653,longitude:-103.7,accuracy:700}} as GeolocationPosition),
  };
  await expect(currentDriverPosition(imprecise)).rejects.toThrow(/poco precisa/);
 });
 it('denied permission cannot signal a connected driver',async()=>{
  const deny={
   getCurrentPosition:(_ok:PositionCallback,bad:PositionErrorCallback)=>bad({code:1} as GeolocationPositionError),
  };
  await expect(currentDriverPosition(deny)).rejects.toThrow(/Autoriza la ubicación/);
  await expect(currentDriverPosition(undefined)).rejects.toThrow(/ubicación GPS disponible/);
 });
});

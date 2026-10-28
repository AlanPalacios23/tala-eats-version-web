import {describe,it,expect,vi,afterEach} from 'vitest';
import {currentDriverPosition,DRIVER_GPS_HEARTBEAT_MS,verifiedOnlinePresence,driverActionsAvailable,validDriverCoordinates} from '../src/lib/driver-presence';
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
  expect(driverActionsAvailable({...online,ready_for_dispatch:true},false)).toBe(false);
  expect(driverActionsAvailable({...online,ready_for_dispatch:true},true)).toBe(true);
  for(const unsafe of [
   {...online,admin_verified:false},
   {...online,online:false},
   {...online,fresh_gps:false},
   {...online,presence_enabled:false},
  ])expect(verifiedOnlinePresence(unsafe)).toBe(false);
  expect(verifiedOnlinePresence(null)).toBe(false);
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

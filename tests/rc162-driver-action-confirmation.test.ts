import {describe,expect,it} from 'vitest';
import {hasConfirmedDriverStage,isUncertainDriverWrite} from '../src/lib/driver-action-confirmation';

describe('RC162: recovery only after ambiguous transport failures',()=>{
 it('accepts timeouts, offline/transport errors and 5xx as unconfirmed writes',()=>{
  for(const status of [0,408,500,502,503,504,599])
   expect(isUncertainDriverWrite({status})).toBe(true);
 });
 it('does not override backend 4xx, PIN lockout or authorization failures',()=>{
  for(const status of [400,401,403,404,409,422,429,200,300,600,NaN,'408',null])
   expect(isUncertainDriverWrite({status})).toBe(false);
  expect(isUncertainDriverWrite(null)).toBe(false);
  expect(isUncertainDriverWrite(new Error('network'))).toBe(false);
 });
});

describe('RC162: own-order authoritative readback',()=>{
 const jobs=[{id:18,status:'ready'},{id:24,status:'picked_up'},
  {id:31,status:'on_the_way'},{id:47,status:'delivered'},
  {id:61,status:'cancelled'}];
 it('confirms only an observed matching order that reached the requested stage',()=>{
  expect(hasConfirmedDriverStage(jobs,24,'assigned')).toBe(true);
  expect(hasConfirmedDriverStage(jobs,24,'picked_up')).toBe(true);
  expect(hasConfirmedDriverStage(jobs,24,'on_the_way')).toBe(false);
  expect(hasConfirmedDriverStage(jobs,31,'picked_up')).toBe(true);
  expect(hasConfirmedDriverStage(jobs,47,'delivered')).toBe(true);
  expect(hasConfirmedDriverStage(jobs,18,'assigned')).toBe(false);
  expect(hasConfirmedDriverStage(jobs,61,'assigned')).toBe(false);
  expect(hasConfirmedDriverStage(jobs,999,'assigned')).toBe(false);
 });
 it('fails closed with missing, corrupt, or untrusted readback',()=>{
  expect(hasConfirmedDriverStage(null,24,'assigned')).toBe(false);
  expect(hasConfirmedDriverStage({},24,'assigned')).toBe(false);
  expect(hasConfirmedDriverStage([{id:'24',status:'delivered'}],24,'delivered')).toBe(false);
  expect(hasConfirmedDriverStage([{id:24,status:'delivered'}],0,'delivered')).toBe(false);
  expect(hasConfirmedDriverStage([{id:24,status:'delivered'}],24,'nonsense' as never)).toBe(false);
 });
});

import {afterEach,describe,expect,it,vi} from 'vitest';
import {ApiError,request} from '../src/lib/api';

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
describe('Pedir comida Web — real HTTP failures and no duplicate financial writes',()=>{
 it('fails a stalled catalog GET after 25 seconds with a useful message',async()=>{
  vi.useFakeTimers();
  vi.stubGlobal('fetch',vi.fn((_url:string,init:RequestInit)=>new Promise((_resolve,reject)=>{
   init.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
  })));
  const requestPromise=request('/restaurants?market_code=TALA-JAL');
  const result=expect(requestPromise).rejects.toMatchObject({status:408});
  await vi.advanceTimersByTimeAsync(25_010);
  await result;
  expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('never retries checkout POST after timeout: client must reconcile by reference',async()=>{
  vi.useFakeTimers();
  const fetcher=vi.fn((_url:string,init:RequestInit)=>new Promise((_resolve,reject)=>{
   init.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
  }));
  vi.stubGlobal('fetch',fetcher);
  const promise=request('/orders',{method:'POST',body:JSON.stringify({client_reference:'ref-safe'})});
  const result=expect(promise).rejects.toMatchObject({status:408});
  await vi.advanceTimersByTimeAsync(45_010);
  await result;
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('rejects malformed successful JSON instead of claiming checkout data is valid',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('<!doctype html>Server error',{status:200,headers:{'Content-Type':'text/html'}})));
  await expect(request('/orders/mine')).rejects.toMatchObject({status:502});
 });
 it('preserves server 422 validation and converts offline network errors',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({detail:'Dirección no válida'}),{status:422})));
  await expect(request('/platform/addresses')).rejects.toMatchObject({status:422,message:'Dirección no válida'});
  vi.stubGlobal('fetch',vi.fn(async()=>{throw new TypeError('Failed to fetch');}));
  await expect(request('/restaurants')).rejects.toMatchObject({status:0,message:expect.stringContaining('conectar')});
 });
 it('supports 204 empty write responses without treating them as failed JSON',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(null,{status:204})));
  await expect(request('/auth/logout',{method:'POST'})).resolves.toBeUndefined();
 });
 it('includes cookies and prevents browser-cache catalog staleness',async()=>{
  const f=vi.fn(async()=>new Response(JSON.stringify([{id:1}]),{status:200}));
  vi.stubGlobal('fetch',f);
  await request('/restaurants');
  expect(f).toHaveBeenCalledWith('/api/v1/restaurants',expect.objectContaining({credentials:'include',cache:'no-store',signal:expect.any(AbortSignal)}));
 });
});

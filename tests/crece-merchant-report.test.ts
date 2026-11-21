import {describe,it,expect} from 'vitest';
import {fetchCreceOrderReport,CRECE_REPORT_PAGE_SIZE,
 CRECE_REPORT_PAGE_LIMIT} from '../src/merchant/creceOrderReport';
import type {Order} from '../src/lib/types';

const order=(id:number,store=7):Order=>({
 id,restaurant_id:store,status:'delivered',created_at:'2026-11-10T09:10:00.000Z',
 order_type:'pickup',payment_method:'cash',payment_status:'paid',
 total:'109.90',items:[{name_snapshot:'Taco',quantity:2,unit_price:'54.95'}]
});
describe('Tala Eats Crece: read-only, bounded merchant reporting',()=>{
 it('retrieves 250 real owner rows from 3 pages without touching kitchen state',async()=>{
  const calls:number[]=[];
  const progress:number[]=[];
  const result=await fetchCreceOrderReport({
   storeId:7,
   fetchPage:async(offset,limit)=>{
    calls.push(offset);
    expect(limit).toBe(100);
    return Array.from({length:Math.min(100,250-offset)},
     (_,n)=>order(250-offset-n));
   },
   onProgress:(_,n)=>progress.push(n)
  });
  expect(calls).toEqual([0,100,200]);
  expect(progress).toEqual([100,200,250]);
  expect(result.orders).toHaveLength(250);
  expect(result.orders[0]?.id).toBe(250);
  expect(result.orders.at(-1)?.id).toBe(1);
  expect(result.pagesRead).toBe(3);
  expect(result.truncated).toBe(false);
 });
 it('fails closed on mixed-store records rather than exporting another owner',async()=>{
  await expect(fetchCreceOrderReport({
   storeId:7,fetchPage:async()=>[order(1,8)]
  })).rejects.toThrow('CRECE_REPORT_RESPONSE_INVALID');
 });
 it('refuses overlapping OFFSET pages, e.g. changing data or ignored offset',async()=>{
  await expect(fetchCreceOrderReport({
   storeId:7,maxPages:2,
   fetchPage:async()=>Array.from({length:100},(_,i)=>order(i+1))
  })).rejects.toThrow('CRECE_REPORT_PAGES_OVERLAP');
 });
 it('makes the limit explicit rather than claiming all history is exported',async()=>{
  let calls=0;
  const result=await fetchCreceOrderReport({
   storeId:7,maxPages:2,
   fetchPage:async(offset)=>{
    calls++;
    return Array.from({length:100},(_,i)=>order(offset+i+1));
   }
  });
  expect(calls).toBe(2);
  expect(result.orders).toHaveLength(200);
  expect(result.truncated).toBe(true);
  expect(CRECE_REPORT_PAGE_LIMIT*CRECE_REPORT_PAGE_SIZE).toBe(2000);
 });
 it('fetches one extra empty page after exact batch boundary',async()=>{
  const result=await fetchCreceOrderReport({
   storeId:7,maxPages:3,
   fetchPage:async(offset)=>offset===0?
    Array.from({length:100},(_,i)=>order(100-i)):[]
  });
  expect(result.orders).toHaveLength(100);
  expect(result.pagesRead).toBe(2);
  expect(result.truncated).toBe(false);
 });
 it('rejects oversized page, fake totals, malformed items and unsafe invalid inputs',async()=>{
  for(const page of [
   {orders:[order(1)]},
   Array.from({length:101},(_,i)=>order(i+1)),
   [{...order(1),total:'NaN'}],
   [{...order(1),items:[{name_snapshot:'Item',quantity:-1}]}]
  ]){
   await expect(fetchCreceOrderReport({
    storeId:7,fetchPage:async()=>page
   })).rejects.toThrow('CRECE_REPORT_RESPONSE_INVALID');
  }
  await expect(fetchCreceOrderReport({
   storeId:0,fetchPage:async()=>[]
  })).rejects.toThrow('CRECE_REPORT_STORE_INVALID');
  await expect(fetchCreceOrderReport({
   storeId:7,maxPages:21,fetchPage:async()=>[]
  })).rejects.toThrow('CRECE_REPORT_LIMIT_INVALID');
 });
 it('aborts without exporting a partial response or fetching further pages',async()=>{
  const controller=new AbortController();
  let calls=0;
  await expect(fetchCreceOrderReport({
   storeId:7,signal:controller.signal,
   fetchPage:async(offset)=>{
    calls++;
    if(offset===0)controller.abort();
    return Array.from({length:100},(_,i)=>order(i+1));
   }
  })).rejects.toThrow('CRECE_REPORT_CANCELLED');
  expect(calls).toBe(1);
 });
 it('propagates errors, never silently downloads an incomplete CSV',async()=>{
  await expect(fetchCreceOrderReport({
   storeId:7,fetchPage:async()=>{throw Error('offline');}
  })).rejects.toThrow('offline');
 });
});

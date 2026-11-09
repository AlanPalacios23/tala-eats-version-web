import {describe,expect,it} from 'vitest';
import {checkPublicStorefront,PUBLIC_STORE_PAGE_SIZE,
 PUBLIC_STORE_MAX_PAGES,CRECE_QR_PNG} from '../src/merchant/crecePublication';

const row=(id:number)=>({id,name:'Comercio '+id});
const batch=(offset:number,size=PUBLIC_STORE_PAGE_SIZE)=>
 Array.from({length:size},(_,index)=>row(offset+index+1));
describe('Crece: public verification at marketplace scale',()=>{
 it('uses printable QR format and four-module quiet zone for reliable scanning',()=>{
  expect(CRECE_QR_PNG).toEqual({
   width:1024,margin:4,errorCorrectionLevel:'Q'
  });
 });
 it('finds a merchant beyond the first 100 without issuing unsafe QR early',async()=>{
  const offsets:number[]=[];
  const result=await checkPublicStorefront({
   storeId:205,
   fetchDetail:async id=>row(id),
   fetchPage:async(offset,limit)=>{
    expect(limit).toBe(100);offsets.push(offset);
    return offset===200?batch(offset,20):batch(offset);
   }
  });
  expect(result).toBe('confirmed');
  expect(offsets).toEqual([0,100,200]);
 });
 it('fails closed when public detail is hidden even if listing might include it',async()=>{
  let calls=0;
  const result=await checkPublicStorefront({
   storeId:4,fetchDetail:async()=>({id:4,name:''}),
   fetchPage:async()=>{calls++;return [row(4)];}
  });
  expect(result).toBe('not-public');
  expect(calls).toBe(0);
 });
 it('never verifies another merchant or non-public catalog record',async()=>{
  expect(await checkPublicStorefront({
   storeId:3,fetchDetail:async()=>row(3),
   fetchPage:async()=>[row(1),row(2)]
  })).toBe('not-public');
  expect(await checkPublicStorefront({
   storeId:3,fetchDetail:async()=>row(4),
   fetchPage:async()=>[row(3)]
  })).toBe('not-public');
 });
 it('returns limit when catalog contains more pages than the safe request budget',async()=>{
  let calls=0;
  const result=await checkPublicStorefront({
   storeId:350,fetchDetail:async()=>row(350),
   fetchPage:async offset=>{calls++;return batch(offset);},
   maxPages:2
  });
  expect(result).toBe('limit');
  expect(calls).toBe(2);
 });
 it('rejects malformed public results, invalid budgets and propagates network errors',async()=>{
  await expect(checkPublicStorefront({
   storeId:2,fetchDetail:async()=>row(2),
   fetchPage:async()=>({id:2})
  })).rejects.toThrow('CRECE_PUBLIC_CATALOG_INVALID');
  await expect(checkPublicStorefront({
   storeId:2,fetchDetail:async()=>row(2),
   fetchPage:async()=>{throw Error('offline');}
  })).rejects.toThrow('offline');
  await expect(checkPublicStorefront({
   storeId:2,fetchDetail:async()=>row(2),
   fetchPage:async()=>[row(2)],maxPages:PUBLIC_STORE_MAX_PAGES+1
  })).rejects.toThrow('CRECE_PUBLIC_PAGE_BUDGET_INVALID');
  expect(await checkPublicStorefront({
   storeId:-1,fetchDetail:async()=>row(-1),fetchPage:async()=>[]
  })).toBe('not-public');
 });
 it('does not continue pagination once user leaves the page',async()=>{
  const controller=new AbortController();
  let page=0;
  await expect(checkPublicStorefront({
   storeId:300,signal:controller.signal,
   fetchDetail:async()=>row(300),
   fetchPage:async offset=>{
    page++;
    if(offset===0)controller.abort();
    return batch(offset);
   }
  })).rejects.toMatchObject({name:'AbortError'});
  expect(page).toBe(1);
 });
});

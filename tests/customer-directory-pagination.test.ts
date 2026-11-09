import {describe,expect,it} from 'vitest';
import {joinRestaurantPages,filterRestaurantDirectory,nextDirectoryOffset,
 PUBLIC_DIRECTORY_PAGE_SIZE,hasNewDirectoryEntries} from '../src/lib/catalogPagination';
import type {Restaurant} from '../src/lib/types';

const shop=(id:number,name='Comercio '+id):Restaurant=>({
 id,name,is_open:true,cover_image_url:null,cuisine:'Mexicana'
});
describe('Customer catalog pagination and marketplace-scale discovery',()=>{
 it('preserves stable order while removing overlapping duplicates on display',()=>{
  const first=[shop(1),shop(2),shop(3)];
  const next=[shop(3),shop(4),shop(5),shop(5)];
  const all=joinRestaurantPages(first,next);
  expect(all.map(x=>x.id)).toEqual([1,2,3,4,5]);
  expect(nextDirectoryOffset(first,next)).toBe(7);
 });
 it('safely ignores invalid IDs instead of exposing a broken store link',()=>{
  expect(joinRestaurantPages([shop(-1),shop(1),shop(0)],
   [shop(2),shop(NaN)]).map(x=>x.id)).toEqual([1,2]);
 });
 it('searches only the loaded subset and handles spanish text',()=>{
  const all=[{...shop(1,'Tortas ahogadas'),description:'Birote'},
    shop(2,'Tacos de birria')];
  expect(filterRestaurantDirectory(all,'  Birria ').map(x=>x.id)).toEqual([2]);
  expect(filterRestaurantDirectory(all,'birote').map(x=>x.id)).toEqual([1]);
  expect(filterRestaurantDirectory(all,'').length).toBe(2);
 });
 it('does not request the same first page indefinitely when OFFSET is ignored',()=>{
  const current=[shop(1),shop(2)];
  expect(hasNewDirectoryEntries(current,[shop(2),shop(1)])).toBe(false);
  expect(hasNewDirectoryEntries(current,[shop(2),shop(3)])).toBe(true);
  expect(hasNewDirectoryEntries(current,[shop(0),shop(NaN)])).toBe(false);
 });
 it('discovery page size matches QR publication checks',()=>{
  expect(PUBLIC_DIRECTORY_PAGE_SIZE).toBe(100);
 });
});

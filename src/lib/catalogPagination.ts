/** Marketplace discovery pagination. Do not claim local search is global
 * when only a subset of the backend catalog has been loaded. */
import type {Restaurant} from './types';

export const PUBLIC_DIRECTORY_PAGE_SIZE=100;

export function joinRestaurantPages(
 first:readonly Restaurant[],additional:readonly Restaurant[]
):Restaurant[]{
 const seen=new Set<number>();
 const output:Restaurant[]=[];
 for(const row of [...first,...additional]){
  if(!row||!Number.isSafeInteger(row.id)||row.id<=0||seen.has(row.id))
   continue;
  seen.add(row.id);
  output.push(row);
 }
 return output;
}
export function filterRestaurantDirectory(
 restaurants:readonly Restaurant[],query:string
):Restaurant[]{
 const normalized=query.trim().toLocaleLowerCase('es-MX');
 if(!normalized)return [...restaurants];
 return restaurants.filter(row=>
  [row.name,row.cuisine,row.description].filter(x=>typeof x==='string')
   .join(' ').toLocaleLowerCase('es-MX').includes(normalized)
 );
}
export function nextDirectoryOffset(
 initial:readonly Restaurant[],additional:readonly Restaurant[]
):number{
 // The backend's OFFSET tracks rows returned, not deduplicated IDs.
 return initial.length+additional.length;
}

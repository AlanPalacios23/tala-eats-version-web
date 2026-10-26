import type {MenuItem,Restaurant} from './types';import {foldSearch} from './mobile-parity';
export interface DishHit {restaurant:Restaurant;item:MenuItem}
/** Flutter SearchScreen uses name/category matching and hides the empty-query dish section. */
export function matchCustomerDishes(restaurants:Restaurant[],query:string):DishHit[]{
 const needle=foldSearch(query);if(!needle)return[];
 return restaurants.flatMap(r=>(r.menu_items??[]).filter(i=>i.is_available&&i.stock>0&&
  foldSearch([i.name,i.category??''].join(' ')).includes(needle)).map(item=>({restaurant:r,item})));
}
export function matchCustomerRestaurants(restaurants:Restaurant[],query:string):Restaurant[]{
 const needle=foldSearch(query);return !needle?restaurants.filter(r=>r.is_open):
  restaurants.filter(r=>foldSearch([r.name,r.cuisine??''].join(' ')).includes(needle));
}

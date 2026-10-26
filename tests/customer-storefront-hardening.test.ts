import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {EMPTY_CART,addVariantItem,remainingForVariant,restoreCustomerCart,updateQuantity} from '../src/lib/cart';
import type {MenuItem} from '../src/lib/types';

const product=(id:number,stock=10):MenuItem=>({
 id,restaurant_id:7,name:'Artículo '+id,price:'29.00',stock,is_available:true
});
const read=(name:string)=>readFileSync(new URL('../src/components/'+name,import.meta.url),'utf8');
const mobile=read('CustomerMobile.tsx');
const commerce=read('CustomerCommerce.tsx');
const checkout=read('CustomerCheckout.tsx');
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/main.css',import.meta.url),'utf8');

describe('Tala Eats Usuarios Web — inventory and cart safety',()=>{
 it('never grows beyond fifty units across distinct products and can be restored',()=>{
  let cart=EMPTY_CART;
  for(let i=1;i<=65;i++)cart=addVariantItem(cart,product(i,1),1);
  expect(cart.entries).toHaveLength(50);
  expect(cart.entries.reduce((sum,e)=>sum+e.quantity,0)).toBe(50);
  expect(restoreCustomerCart(cart)).toEqual(cart);
  expect(remainingForVariant(cart,product(66,1))).toBe(0);
  expect(addVariantItem(cart,product(66,1),1)).toBe(cart);
 });
 it('shares real stock across notes and does not claim an add with no free units',()=>{
  const item=product(1,3);
  const a=addVariantItem(EMPTY_CART,item,2,'Sin cebolla');
  const b=addVariantItem(a,item,1,'Preparación especial');
  expect(remainingForVariant(b,item,'Otro')).toBe(0);
  expect(addVariantItem(b,item,2,'Otro')).toBe(b);
  expect(updateQuantity(b,1,1,'Sin cebolla')).toBe(b);
  expect(updateQuantity(b,1,1)).toBe(b); // Ambiguous variant update
  expect(b.entries.reduce((sum,e)=>sum+e.quantity,0)).toBe(3);
 });
 it('rejects duplicated cart lines and aggregated stock violations on restoration',()=>{
  const item=product(23,3);
  const first=addVariantItem(EMPTY_CART,item,2,'Sin cebolla');
  const duplicate={...first,entries:[...first.entries,...first.entries]};
  expect(restoreCustomerCart(duplicate)).toEqual(EMPTY_CART);
  const overstock={restaurantId:7,entries:[
   {item,quantity:2,note:'Sin cebolla'},
   {item,quantity:2,note:'Con salsa'}
  ]};
  expect(restoreCustomerCart(overstock)).toEqual(EMPTY_CART);
  const inconsistent={restaurantId:7,entries:[
   {item,quantity:1,note:'Sin cebolla'},
   {item:{...item,stock:4},quantity:1,note:'Con salsa'}
  ]};
  expect(restoreCustomerCart(inconsistent)).toEqual(EMPTY_CART);
  const valid={restaurantId:7,entries:[
   {item,quantity:2,note:'Sin cebolla'},
   {item,quantity:1,note:'Con salsa'}
  ]};
  expect(restoreCustomerCart(valid)).toEqual(valid);
 });
 it('respects global capacity for incrementing existing cart lines',()=>{
  let cart=addVariantItem(EMPTY_CART,product(1,100),49);
  cart=addVariantItem(cart,product(2,100),1);
  expect(updateQuantity(cart,1,1,'')).toBe(cart);
  const freed=updateQuantity(cart,2,-1,'');
  expect(remainingForVariant(freed,product(1,100))).toBe(1);
  const revised=updateQuantity(freed,1,1,'');
  expect(revised.entries[0].quantity).toBe(50);
  expect(restoreCustomerCart(revised)).toEqual(revised);
 });
});
describe('Tala Eats Usuarios Web — visual and functional fixes',()=>{
 it('allows delivery-only storefronts to reach server-verified checkout',()=>{
  expect(commerce).toContain('const canOrder=Boolean(merchant?.is_open)');
  expect(commerce).not.toContain('const canOrder=Boolean(merchant?.is_open&&merchant?.pickup_enabled)');
  expect(checkout).toContain("setMode('delivery')");
  expect(checkout).toContain('restaurant?.pickup_enabled!==true');
  expect(checkout).toContain('options?.delivery_checkout_supported!==true');
 });
 it('never offers invented food-only preferences to hardware or grocery stores',()=>{
  expect(commerce).not.toContain("const CHOICES=");
  expect(commerce).toContain('Indicaciones para el comercio');
  expect(commerce).toContain('maxLength={200}');
  expect(commerce).toContain('remainingForVariant(cart,item,note)');
  expect(commerce).toContain("setAddError('No se agregó el producto.");
  expect(app).toContain('if(updated===cart)return false');
 });
 it('searches real market data without one-letter menu fanout or multiple pending favorites',()=>{
  expect(mobile).toContain('normalized.length<2');
  expect(mobile).toContain('favorite.pending!==null');
  expect(mobile).toContain('r.address||marketLabel(market)');
 });
 it('refreshes menu results when crossing two characters and never leaks the prior market',()=>{
  expect(mobile).toContain('setRestaurants(null);setLoading(true)');
  expect(mobile).toContain('[market,restaurants,normalized.length>=2]');
  expect(mobile).toContain('if(normalized.length<2||!restaurants?.length)');
  expect(mobile).toContain('previousFocus?.focus()');
  expect(mobile).toContain('document.body.style.overflow=\'hidden\'');
 });
 it('restores focus after product details and resets stale selection on merchant change',()=>{
  expect(commerce).toContain("setCategory('Todos');setSelected(null);");
  expect(commerce).toContain('previousFocus?.focus()');
  expect(commerce).toContain('aria-modal="true"');
  expect(commerce).toContain('marketLabel(market)');
 });
 it('shows actual product photos and never labels delivery-only carts as free pickup',()=>{
  expect(checkout).toContain('<CustomerPhoto src={entry.item.image_url}');
  expect(checkout).toContain('Estimación antes del envío');
  expect(checkout).not.toContain('Total de referencia para recoger');
  expect(css).toContain('.customer-shell .mobile-cart-item-image');
  expect(css).toContain('.customer-shell .mobile-cart-entry{');
 });
 it('keeps persistent mobile checkout and cart CTAs clear of bottom navigation',()=>{
  expect(css).toContain('.customer-shell .mobile-commerce-cartbar{');
  expect(css).toContain('.customer-shell .mobile-checkout-actions{');
  expect(css).toContain('.customer-shell .mobile-cart>.mobile-checkout-fixed{');
  expect(css).toContain('bottom:max(94px');
  expect(css).toContain('@media(prefers-reduced-motion:reduce)');
 });
});

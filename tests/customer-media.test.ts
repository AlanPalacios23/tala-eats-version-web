import {describe,expect,it} from 'vitest';
import {resolveCustomerImage} from '../src/lib/customer-media';

const ORIGIN='https://web-talaeats.alan-palacios-dev.com';
const STAGE='https://api-stage-talaeats.alan-palacios-dev.com';
const cover='r1-4YiKcP7oVyQdLwDAWJP8y3yiE1O-wA6h.jpg';
const product='r1-p1-fp-ow0ULDj24aM6vkfKWfZAwElFJyXDq.jpg';
const prefix='/api/v1/uploads/catalog/';
describe('verified original catalog image recovery without backend changes',()=>{
 it('maps the ACTUAL restaurant cover and product staging URLs to the LIVE same-origin API proxy',()=>{
  expect(resolveCustomerImage(STAGE+prefix+cover,ORIGIN)).toBe(prefix+cover);
  expect(resolveCustomerImage(STAGE+prefix+product,ORIGIN)).toBe(prefix+product);
 });
 it('preserves genuine original media links and HTTPS merchant photos',()=>{
  expect(resolveCustomerImage(prefix+cover,ORIGIN)).toBe(ORIGIN+prefix+cover);
  expect(resolveCustomerImage(ORIGIN+prefix+cover,ORIGIN)).toBe(ORIGIN+prefix+cover);
  expect(resolveCustomerImage('https://images.example.com/menu.jpg',ORIGIN)).toBe('https://images.example.com/menu.jpg');
 });
 it('does not rewrite or fetch sensitive staged evidence or identity documents',()=>{
  for(const path of ['/api/v1/uploads/delivery-proof/photo.jpg','/api/v1/uploads/onboarding-document/private.jpg','/api/v1/uploads/chat-media/img.jpg','/api/v1/payments/receipt.jpg','/api/v1/uploads/catalog/../secret.jpg']){
   expect(resolveCustomerImage(STAGE+path,ORIGIN)).toBeNull();
  }
 });
 it('rejects signed catalog images, lookalike hosts, unsupported schemes, username/password URLs',()=>{
  for(const raw of [
   STAGE+prefix+cover+'?token=secret',
   STAGE+prefix+cover+'#secret',
   'https://api-stage-talaeats.alan-palacios-dev.com.attacker.test'+prefix+cover,
   'http://api-stage-talaeats.alan-palacios-dev.com'+prefix+cover,
   'https://user:pass@api-stage-talaeats.alan-palacios-dev.com'+prefix+cover,
   STAGE+prefix+'file.svg','javascript:alert(1)','data:image/png;base64,123',
   '//api-stage-talaeats.alan-palacios-dev.com'+prefix+cover,
   ''
  ])expect(resolveCustomerImage(raw,ORIGIN)).toBeNull();
 });
 it('does not break localhost developer images',()=>{
  expect(resolveCustomerImage('/icons/icon-192.png','http://127.0.0.1:4173'))
   .toBe('http://127.0.0.1:4173/icons/icon-192.png');
  expect(resolveCustomerImage('http://example.com/unsafe.jpg',ORIGIN)).toBeNull();
 });
});

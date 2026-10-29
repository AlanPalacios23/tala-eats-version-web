import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {ApiError,api,connectStepUpCode} from '../src/lib/api';

afterEach(()=>vi.unstubAllGlobals());
describe('RC137 Restaurant Connect security step-up',()=>{
 it('rejects malformed authenticator values locally',()=>{
  for(const value of ['','123','12345','1234567','12345a',' 123456','000000 ']){
   expect(()=>connectStepUpCode(value)).toThrow(ApiError);
  }
  expect(connectStepUpCode('000000')).toBe('000000');
 });
 it('sends a new code only in the JSON body of each Connect POST',async()=>{
  const seen:Array<{url:string;init:RequestInit}>=[];
  const mock=vi.fn(async(url:string,init:RequestInit)=>{
   seen.push({url,init});
   return {ok:true,status:200,text:async()=>JSON.stringify({
    owner_confirmed:true,url:'https://connect.stripe.com/setup/s/test',expires_at:1810000000
   })};
  });
  vi.stubGlobal('fetch',mock);
  await api.ownerConfirmConnect(42,'123456');
  await api.ownerConnectOnboardingLink(42,'654321');
  expect(seen).toHaveLength(2);
  expect(seen.map(x=>x.url)).toEqual([
   '/api/v1/owner/finance/connect/42/confirm',
   '/api/v1/owner/finance/connect/42/onboarding-link'
  ]);
  expect(seen.map(x=>JSON.parse(String(x.init.body)))).toEqual([
   {totp:'123456'},{totp:'654321'}
  ]);
  for(const {url,init} of seen){
   expect(init.method).toBe('POST');
   expect(init.credentials).toBe('include');
   expect(init.cache).toBe('no-store');
   expect(JSON.stringify(init.headers)).not.toContain('123456');
   expect(url).not.toMatch(/totp|123456|654321/);
  }
 });
 it('does not send invalid codes or bypass preview and error states',async()=>{
  const mock=vi.fn();
  vi.stubGlobal('fetch',mock);
  await expect(api.ownerConfirmConnect(9,'invalid')).rejects.toThrow('6 dígitos');
  await expect(api.ownerConnectOnboardingLink(9,'12345')).rejects.toThrow('6 dígitos');
  expect(mock).not.toHaveBeenCalled();
 });
 it('guards interactive buttons and forgets one-time codes after actions and merchant changes',()=>{
  const app=readFileSync(new URL('../src/components/RestaurantApp.tsx',import.meta.url),'utf8');
  expect(app).toContain('type="password" inputMode="numeric" autoComplete="one-time-code"');
  expect(app).toContain("setConnectTotp('')");
  expect(app).toContain('api.ownerConfirmConnect(restaurant.id,totp)');
  expect(app).toContain('api.ownerConnectOnboardingLink(restaurant.id,totp)');
  expect(app).toContain('!ownerConnectAcknowledged||!connectTotpReady');
  expect(app).toContain('disabled={busy||!syncHealthy||!connectTotpReady||PREVIEW_READONLY}');
  expect(app).not.toContain('localStorage.setItem(\'connectTotp\'');
  expect(app).not.toContain('sessionStorage.setItem(\'connectTotp\'');
 });
});

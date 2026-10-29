import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');

describe('RC136 Kali static-only deployment safety',()=>{
 const build=read('../deploy/rc136-kali-build-three-pwa.sh');
 const promote=read('../deploy/rc136-kali-promote-three-pwa.sh');
 it('builds three role-separated bundles by pinned SHA with tests',()=>{
  expect(build).toContain('git -C "$TARGET" checkout --detach "$SHA"');
  expect(build).toContain('npm run check');
  expect(build).toContain('dist-restaurantes/restaurantes.html');
  expect(build).toContain('dist-repartidores/repartidores.html');
  expect(build).toContain('VITE_FINANCE_WALLET_V2_ENABLED');
  expect(build).toContain('VITE_CASH_HANDOFF_V2_ENABLED');
 });
 it('requires the ACTUAL authenticated upload route before PWA cutover',()=>{
  expect(promote).toContain('onboarding-capabilities');
  expect(promote).toContain('uploads/onboarding-document');
  expect(promote).toContain('PRIVATE_UPLOAD_ENDPOINT_EXPECTED_401');
  expect(promote).toContain('DRIVER_ONBOARDING_BACKEND_CAPABILITY_MISSING');
  expect(promote).toContain('BACKEND_DOCUMENTS_AND_THREE_PORTALS');
 });
 it('uses existing per-site atomic scripts with explicit approval and reverse rollback',()=>{
  for(const item of ['kali-update-existing-public.sh','kali-update-restaurantes-isolated.sh',
                      'kali-update-repartidores-isolated.sh'])expect(promote).toContain(item);
  expect(promote).toContain('I_APPROVE_RC136_THREE_STATIC_PWA_ONLY');
  expect(promote).toContain('I_APPROVE_PUBLIC_STATIC_ROLLBACK');
  expect(promote).toContain('I_APPROVE_RESTAURANTES_STATIC_ROLLBACK_ONLY');
  expect(promote).toContain('I_APPROVE_REPARTIDORES_STATIC_ROLLBACK_ONLY');
  expect(promote).toContain('trap recover EXIT');
 });
 it('never restarts PM2, migrates DB or changes Stripe release flags',()=>{
  for(const shell of [build,promote]){
   expect(shell).not.toMatch(/(?:^|\n)\s*pm2\s+(?:restart|reload|delete|start)/);
   expect(shell).not.toMatch(/(?:^|\n)\s*prisma\s+migrate\s+deploy/);
   expect(shell).not.toMatch(/(?:^|\n)\s*systemctl\s+(?:restart|stop|start|reload)/);
   expect(shell).not.toContain('STRIPE_LIVE_ENABLED=true');
  }
 });
});

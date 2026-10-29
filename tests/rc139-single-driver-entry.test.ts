import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {canonicalDriverRoute,driverPortalDestination,DRIVER_DOMAIN} from '../src/lib/driver-host';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
describe('RC139 one canonical Driver PWA for ALL old customer-origin links',()=>{
 const app=read('src/App.tsx');
 const script=read('deploy/rc139-kali-driver-canonical-redirect.sh');
 const nginx=read('deploy/nginx-web-talaeats.conf');
 it('canonicalizes login, register and home, never accepts dynamic redirects',()=>{
  expect(DRIVER_DOMAIN).toBe('https://repartidores-talaeats.alan-palacios-dev.com');
  expect(driverPortalDestination()).toBe(DRIVER_DOMAIN+'/repartidor');
  for(const [oldPath,newPath] of [
   ['/repartidor','/repartidor'],['/repartidor/acceso','/repartidor/acceso'],
   ['/repartidor/registro','/repartidor/registro'],['/repartidor/otra','/repartidor'],
   ['/repartidor/%2f%2fevil.example','/repartidor'],
  ])expect(canonicalDriverRoute(oldPath)).toBe(DRIVER_DOMAIN+newPath);
 });
 it('main customer app never renders duplicated driver registration or delivery screens',()=>{
  expect(app).toContain('window.location.replace(href)');
  expect(app).toContain('function DriverCanonicalRedirect(');
  expect(app).toContain('<Route path="/repartidor/*" element={<DriverCanonicalRedirect suffix=""/>}/>');
  expect(app).not.toContain("from './components/DriverRegistration'");
  expect(app).not.toContain("from './components/DriverPwaWorkflow'");
  expect(app).not.toContain('VITE_DRIVER_APP_URL');
  expect(app).toContain('<a href={driverPortalDestination()}>Repartidores</a>');
 });
 it('Kali HTTP redirect changes ONLY 18195 config with rollback, not backend or fintech flags',()=>{
  const shell=spawnSync('bash',['-n','deploy/rc139-kali-driver-canonical-redirect.sh'],{encoding:'utf8'});
  expect(shell.status).toBe(0);
  expect(script).toContain('RC139_REDIRECT_PLAN=PASS_READ_ONLY');
  expect(script).toContain('RC139_DIAG=READ_ONLY');
  expect(script).toContain('RC139_DIAG_PATH=');
  expect(script).toContain('check_routes_retry');
  expect(script).toContain('check_public_retry');
  expect(script).toContain('RC139_REDIRECT=HOLD_PUBLIC_HTTPS_POSTCHECK');
  expect(script).toContain('RC139_REDIRECT=FAILED_CONFIG_RESTORED_RELOAD_REQUESTED');
  expect(script).toContain('I_APPROVE_RC139_MAIN_DRIVER_REDIRECT_ONLY');
  expect(script).toContain('RC139_REDIRECT=PASS_MAIN_18195_TO_DRIVER_18199');
  expect(script).toContain('systemctl reload "$SERVICE"');
  expect(script).toContain('cp -a -- "$BACKUP" "$CONFIG"');
  expect(script).toContain("'/repartidor/acceso|/repartidor/acceso'");
  expect(script).toContain("'/repartidor/registro|/repartidor/registro'");
  expect(script).toContain('Fixed URLs only.');
  expect(script).not.toContain('return 301');
  expect(script).not.toContain('return 308');
  for(const unsafe of ['pm2 restart','psql','stripe transfer','STRIPE_LIVE_ENABLED=true'])
   expect(script).not.toContain(unsafe);
  expect(nginx).toContain('listen 127.0.0.1:18195;');
  expect(nginx).toContain('root /srv/talaeats-pwa/current;');
 });
});

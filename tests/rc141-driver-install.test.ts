import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {
 driverInstallPlatform,driverPwaInstalled,driverInstallEligible,driverInstallSnoozed,
 DRIVER_INSTALL_PROMPT_DELAY_MS,DRIVER_INSTALL_SNOOZE_DAYS,DRIVER_INSTALL_HELP_EVENT,
} from '../src/lib/driver-install';

const read=(file:string)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const install=read('src/components/DriverPwaInstall.tsx');
const standalone=read('src/DriverStandalone.tsx');
const workflow=read('src/components/DriverPwaWorkflow.tsx');
const onboarding=read('src/components/DriverRegistration.tsx');
const css=read('src/styles/driver-install.css');
const manifest=JSON.parse(read('public/manifest-repartidor.webmanifest')) as Record<string,unknown>;

describe('RC141 Driver PWA native install experience',()=>{
 it('detects supported mobile systems and never claims automatic iOS installation',()=>{
  expect(driverInstallPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)')).toBe('ios');
  expect(driverInstallPlatform('Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36')).toBe('android');
  expect(driverInstallPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('other');
  expect(install).toContain("if(!event||platform!=='android')");
  expect(install).toContain('Añadir a pantalla de inicio');
  expect(install).toContain('iOS necesita tu confirmación.');
  expect(install).not.toContain('navigator.share(');
 });
 it('shows only on driver routes and suppresses installed and preview apps',()=>{
  expect(driverPwaInstalled(true,false)).toBe(true);
  expect(driverPwaInstalled(false,true)).toBe(true);
  expect(driverPwaInstalled(false,false)).toBe(false);
  expect(driverInstallEligible('/repartidor/acceso','ios',false,false)).toBe(true);
  expect(driverInstallEligible('/repartidor/registro','android',false,false)).toBe(true);
  expect(driverInstallEligible('/repartidor','android',false,false)).toBe(true);
  expect(driverInstallEligible('/repartidor','other',false,false)).toBe(false);
  expect(driverInstallEligible('/repartidor','android',true,false)).toBe(false);
  expect(driverInstallEligible('/repartidor','android',false,true)).toBe(false);
  expect(driverInstallEligible('/clientes','android',false,false)).toBe(false);
  const now=2000000000000;
  expect(driverInstallSnoozed(String(now+86400000),now)).toBe(true);
  expect(driverInstallSnoozed(String(now-1),now)).toBe(false);
  expect(driverInstallSnoozed('invalid',now)).toBe(false);
  expect(DRIVER_INSTALL_PROMPT_DELAY_MS).toBeGreaterThan(500);
  expect(DRIVER_INSTALL_SNOOZE_DAYS).toBe(7);
 });
 it('calls native Android prompt from click and respects browser dismissal',()=>{
  expect(install).toContain("window.addEventListener('beforeinstallprompt',onPrompt)");
  expect(install).toContain("window.addEventListener('appinstalled',onInstalled)");
  expect(install).toContain('raw.preventDefault()');
  expect(install).toContain('await event.prompt()');
  expect(install).toContain('const choice=await event.userChoice');
  expect(install).toContain("choice?.outcome==='accepted'");
  expect(install).toContain('setHelp(true)');
  expect(install).toContain("new Event(DRIVER_INSTALL_HELP_EVENT)");
  expect(install).toContain('window.matchMedia?.(\'(display-mode: fullscreen)\')');
  expect(install).toContain("(navigator as IOSNavigator).standalone===true");
 });
 it('preserves the independent entry and allows re-opening help from app and onboarding',()=>{
  expect(standalone).toContain('<DriverPwaInstallNotice/>');
  expect(standalone).not.toContain('CustomerPwaInstallNotice');
  expect(workflow).toContain('<DriverPwaInstallButton/>');
  expect(onboarding.split('<DriverPwaInstallButton/>').length-1).toBe(2);
  expect(css).toContain('env(safe-area-inset-bottom)');
  expect(css).toContain('@media(prefers-reduced-motion:reduce)');
  expect(css).toContain('.dd-standalone:has(.df-bottom-nav) .di-notice');
 });
 it('retains separately scoped full-screen standalone manifest and safe worker',()=>{
  expect(manifest.id).toBe('/app-repartidor');
  expect(manifest.start_url).toBe('/repartidor');
  expect(manifest.display).toBe('standalone');
  expect(manifest.display_override).toEqual(['fullscreen','standalone']);
  const sw=read('public/sw-repartidor.js');
  expect(sw).toContain("if(req.method!=='GET')return");
  expect(sw).toContain("req.mode==='navigate'");
  expect(sw).toContain("u.pathname.startsWith('/api/')");
  expect(sw).not.toContain("cache.addAll(['/repartidor']");
 });
});

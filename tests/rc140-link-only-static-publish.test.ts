import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const script=read('deploy/rc140-kali-link-only.sh');
const bridge=read('deploy/rc140-driver-link.js');
const app=read('src/App.tsx');
const target='https://repartidores-talaeats.alan-palacios-dev.com/repartidor/acceso';

describe('RC140: link-only public frontend rollout',()=>{
 it('public menu, footer and landing all open the exact official driver LOGIN',()=>{
  expect(app).toContain('<a href="'+target+'">Repartidores</a>');
  expect(app).toContain('<a href="'+target+'">Soy repartidor</a>');
  expect(app).toContain("item.path==='/repartidor'?'"+target+"':item.path");
 });
 it('only injects self-hosted browser link adapter without replacing SPA or reloading Nginx',()=>{
  expect(spawnSync('bash',['-n','deploy/rc140-kali-link-only.sh']).status).toBe(0);
  expect(spawnSync('node',['--check','deploy/rc140-driver-link.js']).status).toBe(0);
  expect(script).toContain('RC140_PLAN=PASS_READ_ONLY');
  expect(script).toContain('RC140_DEPLOY=PASS_LINK_ONLY_STATIC_NO_NGINX_RELOAD');
  expect(script).toContain('ONLY_MAIN_STATIC_HTML_AND_ONE_JS_LINK_HELPER');
  expect(script).toContain('cmp -s "$file" "$DEST/$relative"');
  expect(script).toContain('RC140_ONLY_ONE_HTML_SCRIPT_INJECTION=PASS');
  expect(script).toContain('RC140_ROLLBACK=PASS_PREVIOUS_FRONTEND_RESTORED');
  expect(script).toContain('I_APPROVE_RC140_LINK_ONLY_STATIC_18195');
  expect(script).toContain('I_APPROVE_RC140_LINK_ONLY_ROLLBACK');
  expect(script).not.toMatch(/systemctl (restart|reload|stop|start|enable)/);
  expect(script).not.toMatch(/pm2 (restart|reload)/);
  expect(script).not.toContain('/etc/talaeats-web-pwa/server.conf" "$');
  expect(script).not.toContain('chown root:www-data');
 });
 it('driver bridge changes only main-origin /repartidor and uses real browser navigation',()=>{
  expect(bridge).toContain("u.origin===window.location.origin");
  expect(bridge).toContain("u.pathname==='/repartidor'");
  expect(bridge).toContain("u.pathname==='/repartidor/acceso'");
  expect(bridge).toContain('window.location.assign(DEST)');
  expect(bridge).toContain('anchor.setAttribute(\'href\',DEST)');
  expect(bridge).toContain('event.stopImmediatePropagation()');
  expect(bridge).toContain(target);
  expect(bridge).not.toContain('fetch(');
  expect(bridge).not.toContain('localStorage');
 });
});

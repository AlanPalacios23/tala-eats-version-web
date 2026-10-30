import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LEGAL_LINKS } from '../src/lib/legal-links';

const read = (name:string)=>readFileSync(new URL(name,import.meta.url),'utf8');
const config=read('../deploy/nginx-web-talaeats.conf');

describe('RC14.2 canonical legal pages — PREDEPLOY only',()=>{
  it('prepares only explicit legal paths on the existing public Web nginx origin',()=>{
    expect(config).toContain('listen 127.0.0.1:18195;');
    expect(config).toContain('root /srv/talaeats-pwa/current;');
    expect(config).toContain('server_name web-talaeats.alan-palacios-dev.com;');
    for(const route of ['/privacidad','/eliminar-cuenta']){
      expect(config).toContain(`location = ${route} {`);
    }
    // Preserve the actual independently managed legal service and its deletion flow.
    expect((config.match(/proxy_pass http:\/\/127\.0\.0\.1:18191;/g)||[]).length).toBe(2);
    expect(config).toContain('proxy_set_header X-Forwarded-Proto https;');
    expect(config).toContain('proxy_redirect off;');
    expect(config).not.toContain('return 301 /eliminar-cuenta');
  });
  it('retains the production API and existing legal links until explicit nginx cutover',()=>{
    expect(config).toContain('location ^~ /api/v1/ {');
    expect(config).toContain('proxy_pass http://127.0.0.1:18190;');
    expect(LEGAL_LINKS.privacy).toBe('https://talaeats.alan-palacios-dev.com/privacidad');
    expect(LEGAL_LINKS.deletion).toBe('https://talaeats.alan-palacios-dev.com/eliminar-cuenta');
    expect(LEGAL_LINKS.terms).toBe('https://web-talaeats.alan-palacios-dev.com/legal/terminos.html');
  });
  it('does not permit static-only deploy to silently overwrite nginx config',()=>{
    const staticDeploy=read('../deploy/kali-update-existing-public.sh');
    expect(staticDeploy).not.toContain('install -m 644 "$SRC/deploy/nginx-web-talaeats.conf"');
    expect(staticDeploy).not.toContain('systemctl reload');
  });
});

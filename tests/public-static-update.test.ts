import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const script=readFileSync(new URL('../deploy/kali-update-existing-public.sh',import.meta.url),'utf8');

describe('public domain static deployment safety',()=>{
 it('targets current production site 18195, not new preview port',()=>{
  expect(script).toContain('HOST=web-talaeats.alan-palacios-dev.com');
  expect(script).toContain('ORIGIN=http://127.0.0.1:18195');
  expect(script).toContain('BASE=/srv/talaeats-pwa');
  expect(script).not.toContain('ORIGIN=http://127.0.0.1:18196');
  expect(script).toContain('root /srv/talaeats-pwa/current;');
 });
 it('requires explicit approval and checks production assets',()=>{
  expect(script).toContain('I_APPROVE_PUBLIC_STATIC_18195_ONLY');
  expect(script).toContain('PUBLIC_PWA_ABORT=READONLY_PREVIEW_BUILD_NOT_FOR_PUBLIC');
  expect(script).toContain('PUBLIC_PWA_ABORT=CHECKOUT_SHA_MISMATCH');
  expect(script).toContain('PUBLIC_PWA_ABORT=BACKEND_LIVE_HEALTH_MISMATCH');
  expect(script).toContain('PUBLIC_PWA_ABORT=PUBLIC_NGINX_SERVICE_NOT_ACTIVE');
 });
 it('preserves original release and permits rollback without changing production API',()=>{
  expect(script).toContain('BACKUP_BASE="$BASE/backups"');
  expect(script).toContain('cp -a -- "$OLD" "$BACKUP"');
  expect(script).toContain('PREVIOUS="$BASE/previous-public"');
  expect(script).toContain('PUBLIC_PWA_ROLLBACK=PASS');
  expect(script).toContain('mv -Tf "$TMP" "$CURRENT"');
  expect(script).not.toContain('systemctl reload nginx');
  expect(script).not.toContain('pm2 restart');
  expect(script).not.toContain('cloudflared tunnel');
  expect(script).not.toContain('stripe transfers');
 });
});

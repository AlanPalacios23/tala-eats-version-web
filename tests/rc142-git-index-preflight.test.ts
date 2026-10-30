import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const files=[
 'deploy/rc138-kali-driver-live-preflight.sh',
 'deploy/kali-update-repartidores-isolated.sh',
 'deploy/rc141-kali-driver-headers-18199.sh',
 'deploy/rc138-kali-build-driver-only.sh',
];
describe('RC142 deployment gate must fail closed on inaccessible Git indexes',()=>{
 for(const file of files)it(file+' checks command exit status before trusting clean tree',()=>{
  const script=read(file);
  expect(spawnSync('bash',['-n',file],{encoding:'utf8'}).status).toBe(0);
  expect(script).toMatch(/actual="\$\(git .*? rev-parse HEAD\)" \|\| \{/);
  expect(script).toMatch(/tracked="\$\(git .*? status --porcelain --untracked-files=no\)" \|\| \{/);
  expect(script).toContain('HOLD_GIT_INDEX_UNREADABLE');
  expect(script).toContain('HOLD_GIT_REV_PARSE');
  expect(script).toMatch(/\[\[ "\$actual" == "\$(?:expected|SHA)" && -z "\$tracked" \]\]/);
  expect(script).not.toMatch(/-z "\$\(git .*? status --porcelain/);
 });
 it('root-level Nginx header and static plan reads must never mutate the service-user git index',()=>{
  for(const file of ['deploy/rc141-kali-driver-headers-18199.sh',
                     'deploy/kali-update-repartidores-isolated.sh']){
   const script=read(file);
   expect(script).toContain('export GIT_OPTIONAL_LOCKS=0');
   expect(script).toContain('status --porcelain --untracked-files=no');
  }
 });
 it('read-only probes report errors instead of masking stderr-only failures',()=>{
  const cmd='value="$(sh -c \'echo fatal-index >&2; exit 128\')" || exit 5; test -z "$value"';
  const result=spawnSync('bash',['-c',cmd],{encoding:'utf8'});
  expect(result.status).toBe(5);
  expect(result.stderr).toContain('fatal-index');
 });
});

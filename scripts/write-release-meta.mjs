import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const git=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',timeout:5000,windowsHide:true});
const result=git.status===0?git.stdout.trim():'';
const sha=/^[a-f0-9]{40}$/.test(result)?result:null;
const payload={
  app:'tala-eats-restaurantes-pwa',
  channel:'rc166',
  source_sha:sha,
  built_at:new Date().toISOString()
};
writeFileSync(resolve(root,'public','release.json'),JSON.stringify(payload,null,2)+'\n',{encoding:'utf8'});
console.log('PWA_RELEASE_META='+ (sha??'NO_GIT_SHA_BUILD_UNVERIFIED'));

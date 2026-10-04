import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { ROOT, DATA_HOME } from '../runtime/paths.mjs';

const output = path.resolve(process.argv[2]);
fs.mkdirSync(output, { recursive: true });
const reports=[];
for (const phase of ['default','legacy']) {
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'gpt-appearance-'));
  fs.writeFileSync(path.join(dataDir,'ui-state.json'),JSON.stringify({'dshw-pos':JSON.stringify({v:2,hAnchor:'left',hDist:80,vAnchor:'top',vDist:80})}));
  if(phase==='legacy') fs.writeFileSync(path.join(dataDir,'.dshw-bubble.json'),JSON.stringify({v:1,items:[{kind:'custom',modules:[{type:'text',text:'余额提醒'},{type:'balance'},{type:'image',imgId:'bimg_yue_money'}]}],lib:[]}));
  const env={...process.env,WHALE_DESKTOP_TEST:'1',WHALE_GPT_APPEARANCE:'1',WHALE_GPT_PHASE:phase,WHALE_DESKTOP_VERIFY_DIR:output};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(path.join(DATA_HOME,'desktop-runtime/node_modules/electron/dist/electron.exe'),[path.join(ROOT,'desktop/main.cjs'),'--whale-data='+dataDir],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let diagnostic='';child.stdout.resume();child.stderr.on('data',b=>{diagnostic=(diagnostic+b).slice(-10000);});
  const timeout=setTimeout(()=>child.kill(),60000);const [code]=await once(child,'close');clearTimeout(timeout);
  const file=path.join(output,'gpt-'+phase+'.json');const report=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{ok:false,diagnostic};reports.push(report);
  fs.writeFileSync(path.join(output,'gpt-appearance.json'),JSON.stringify({ok:reports.every(r=>r.ok)&&code===0,reports},null,2));
  assert.equal(code,0,JSON.stringify(report));assert.equal(report.ok,true,JSON.stringify(report));
}
console.log(JSON.stringify({ok:true,output,checks:reports.flatMap(r=>r.checks)}));

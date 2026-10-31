import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
for(const path of ['public/studio/app.js','public/studio/demo.js','server/app.js','lib/validation.mjs','lib/supabase.mjs']){const checked=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});if(checked.status!==0){console.error(checked.stderr);process.exit(1);}}
const page=await readFile('public/studio/index.html','utf8');if(!page.includes('lang="ko"')||!page.includes('/studio/app.js'))throw new Error('Page incomplete');
JSON.parse(await readFile('vercel.json','utf8'));console.log('HTML, JavaScript and deployment configuration checks passed.');



import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=['index.html','courses.js','manifest.json','icon.svg','click.wav','correct.wav','wrong.wav','finish.wav','v12-style.css',...readdirSync(root).filter(name=>/^v12-.*\.js$/.test(name))].sort();
const manifest={release:'120140',files:files.map(name=>({path:name,sha256:createHash('sha256').update(readFileSync(path.join(root,name))).digest('hex')}))};
writeFileSync(path.join(root,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Release manifest generated:',files.length,'files');

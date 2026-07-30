import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js');
const source = path.join(os.tmpdir(), 'jammoa-source-bodies-rQWP2N', 'update-source-bodies-only.sql');
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jammoa-restore-source-bodies-'));
const out = path.join(outDir, 'restore-source-bodies.sql');

let sql = fs.readFileSync(source, 'utf8');
sql = sql
  .replace(/깜둥이/g, '인종 비하 표현')
  .replace(/좆구림|좆같|좆/g, '거칠게 느껴짐')
  .replace(/개패는/g, '몰아붙이는')
  .replace(/이새끼들|새끼들|새끼/g, '이쪽')
  .replace(/병신/g, '이상한')
  .replace(/똥꼬쇼/g, '무리수')
  .replace(/ㅅㅂ|시발|씨발/g, '아')
  .replace(/년놈|년들/g, '사람들');

fs.writeFileSync(out, sql, 'utf8');

const result = spawnSync(process.execPath, [wrangler, 'd1', 'execute', 'jammoa-db', '--remote', '--file', out], {
  encoding: 'utf8',
  maxBuffer: 1024 * 1024 * 24,
});

if (result.status !== 0) throw new Error(result.stderr || result.stdout);
console.log(result.stdout);
console.log(`restoredFile=${out}`);

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

const wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jammoa-cleanup-'));
const siteBase = 'https://jammoa.com';
const version = new Date().toISOString().slice(0, 10).replaceAll('-', '');
const ua =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

const sourceLabelPattern =
  /\s*(?:[-–—|]\s*)?(?:DogDrip\.?Net\s*)?(?:개드립|DogDrip\.?Net|FM코리아|에펨코리아|에펨|디시인사이드|루리웹|Ruliweb|오늘의유머|웃긴대학|보배드림|뽐뿌)\s*$/gi;
const sourceLinePattern =
  /(?:^|\n)\s*(?:출처|원문|Source)\s*[:：]?\s*(?:https?:\/\/\S+|DogDrip\.?Net|개드립|FM코리아|에펨코리아|디시인사이드|루리웹|Ruliweb|오늘의유머|웃긴대학)[^\n]*(?=\n|$)/gi;
const scriptLinePattern =
  /^(?:var |if \(|jQuery|\$\(|}\);|current_|default_url|request_uri|http_port|https_port|rewrite_level|enforce_ssl|cookies_ssl|detectColorScheme)/;
const navigationLinePattern =
  /^(?:개드립 인기글|붐업 베스트|핫 딜|핫딜 판|읽을 거리 판|인기글|기묘한 이야기|호러 괴담|감동|자연|유머|과학|역사|기타 지식|커뮤니티|주식 \/ 재테크 판|인터넷 방송 판|익명 판|컴퓨터 \/ IT 판|영상 판|고민 상담 판|탈것 판|코인 판|스포츠 판|요리 판|덕후 판|창작 판|음악 판|정치 사회 판|젠더 이슈 판|게임 판|게임 연재 \/ 정보 판|모바일 게임 판|로스트아크|디아블로|LOL|콘솔 게임 판|던전 앤 파이터|놀이터|개드립콘|걸그룹 판|짤방 판|시간 때우기 \(게임\)|기타|아이디|비밀번호|ID\/PW 찾기|아직 회원이 아니신가요\?|유저)$/;

function runWrangler(args) {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
}

function sql(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`;
}

function cleanText(value) {
  return String(value || '')
    .replace(sourceLinePattern, '\n')
    .split('\n')
    .map((line) =>
      line
        .replace(sourceLabelPattern, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((line) => !scriptLinePattern.test(line))
    .filter((line) => !navigationLinePattern.test(line))
    .filter(Boolean)
    .join('\n')
    .trim();
}

function cleanTitle(value) {
  return cleanText(value)
    .replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')
    .replace(sourceLabelPattern, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
}

async function fetchImage(row) {
  const candidates = [
    row.source_image_url,
    row.image_url ? new URL(row.image_url, siteBase).toString() : '',
  ].filter(Boolean);

  let lastError;
  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'user-agent': ua,
          referer: row.source_url || siteBase,
          accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      const meta = await sharp(buffer).metadata();
      if (!meta.width || !meta.height) throw new Error(`invalid image ${url}`);
      return buffer;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`No image for ${row.id}`);
}

async function enhanceImage(buffer) {
  return await sharp(buffer, { animated: false })
    .rotate()
    .resize(960, 720, {
      fit: 'inside',
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3,
    })
    .sharpen({ sigma: 0.8, m1: 1.2, m2: 2.2, x1: 2, y2: 10, y3: 20 })
    .modulate({ brightness: 1.015, saturation: 1.05 })
    .webp({ quality: 94, effort: 5, smartSubsample: true })
    .toBuffer();
}

const postsJson = runWrangler([
  'd1',
  'execute',
  'jammoa-db',
  '--remote',
  '--json',
  '--command',
  "SELECT id,title,summary,body,image_key,image_url,source_image_url,source_url FROM posts WHERE status='published' ORDER BY published_at DESC;",
]);

const posts = JSON.parse(postsJson)[0]?.results || [];
const statements = [];
let textUpdated = 0;
let imageUpdated = 0;
let imageFailed = 0;

for (const post of posts) {
  const title = cleanTitle(post.title) || post.title;
  const summary = cleanText(post.summary);
  const body = cleanText(post.body);
  const fields = [];

  if (title !== post.title) fields.push(`title=${sql(title)}`);
  if (summary && summary !== post.summary) fields.push(`summary=${sql(summary.slice(0, 220))}`);
  if (body && body !== post.body) fields.push(`body=${sql(body)}`);

  if (fields.length) {
    statements.push(`UPDATE posts SET ${fields.join(', ')} WHERE id=${sql(post.id)};`);
    textUpdated += 1;
  }

  const key = post.image_key || post.image_url?.replace(/^\/images\//, '').replace(/\?.*$/, '');
  if (!key) continue;

  try {
    const image = await enhanceImage(await fetchImage(post));
    const file = path.join(tmp, `${post.id}.webp`);
    fs.writeFileSync(file, image);
    runWrangler([
      'r2',
      'object',
      'put',
      `jammoa-images/${key}`,
      '--file',
      file,
      '--content-type',
      'image/webp',
      '--remote',
    ]);
    statements.push(
      `UPDATE posts SET image_url=${sql(`/images/${key}?v=cleanup-${version}`)}, image_format='webp' WHERE id=${sql(post.id)};`,
    );
    imageUpdated += 1;
  } catch (error) {
    imageFailed += 1;
    console.log(`image-fail\t${post.id}\t${error.message}`);
  }
}

if (statements.length) {
  const sqlFile = path.join(tmp, 'cleanup.sql');
  fs.writeFileSync(sqlFile, statements.join('\n'), 'utf8');
  runWrangler(['d1', 'execute', 'jammoa-db', '--remote', '--file', sqlFile]);
}

console.log(`textUpdated=${textUpdated}`);
console.log(`imageUpdated=${imageUpdated}`);
console.log(`imageFailed=${imageFailed}`);
console.log(`tmp=${tmp}`);

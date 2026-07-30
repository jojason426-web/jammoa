import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as cheerio from 'cheerio';
import sharp from 'sharp';

const wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jammoa-list-thumbs-'));
const version = 'list-source-20260721a';
const ua =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

const blockedTitle =
  /후방|19금|ㅇㅎ|비키니|노출|섹시|성인|야짤|av|성폭행|강간|임신|장애인|가슴|ㅅㅅ|파이즈리|따 먹|치마가 짧|유부녀|음란|포르노|살인|알몸|나체|야한|처녀|아아앙|길다란걸|욕박|병신|음란/i;

const lists = [
  ...Array.from({ length: 6 }, (_, index) => ({
    name: '디시인사이드',
    boardId: 'issue',
    url: `https://gall.dcinside.com/board/lists/?id=dcbest&page=${index + 1}`,
  })),
  ...Array.from({ length: 4 }, (_, index) => ({
    name: '개드립',
    boardId: 'legend',
    url: index === 0 ? 'https://www.dogdrip.net/' : `https://www.dogdrip.net/dogdrip?page=${index + 1}`,
  })),
];

function runWrangler(args) {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 24,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
}

function absUrl(value, base) {
  if (!value) return '';
  try {
    return new URL(String(value).trim(), base).toString();
  } catch {
    return '';
  }
}

function cleanTitle(title) {
  return String(title || '')
    .replace(/\[[^\]]+?\]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 72);
}

function sqlValue(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': ua, referer: new URL(url).origin },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return await response.text();
}

async function fetchImage(url, referer) {
  const response = await fetch(url, {
    headers: {
      'user-agent': ua,
      referer,
      accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height || metadata.width < 80 || metadata.height < 60) {
    throw new Error('small image');
  }
  return await sharp(buffer)
    .resize(160, 90, { fit: 'cover', position: 'attention' })
    .webp({ quality: 86, effort: 4 })
    .toBuffer();
}

function collectFromDc($, list) {
  const items = [];
  $('a[href]').each((_, anchor) => {
    const row = $(anchor).closest('tr');
    const img = row.find('img').first();
    const imageUrl = absUrl(img.attr('src') || img.attr('data-src') || img.attr('data-original'), list.url);
    const href = absUrl($(anchor).attr('href'), list.url);
    const title = cleanTitle($(anchor).text());
    if (!imageUrl || !href || title.length < 5 || blockedTitle.test(title)) return;
    if (!/view\/\?/.test(href) && !/\/board\/view/.test(href)) return;
    items.push({ ...list, title, url: href.replace(/#.*$/, ''), imageUrl });
  });
  return items;
}

function collectFromGeneric($, list) {
  const items = [];
  $('a[href]').each((_, anchor) => {
    const parent = $(anchor).closest('article,li,tr,div');
    const img = parent.find('img').first();
    const imageUrl = absUrl(img.attr('src') || img.attr('data-src') || img.attr('data-original'), list.url);
    const href = absUrl($(anchor).attr('href'), list.url);
    const title = cleanTitle($(anchor).text() || img.attr('alt'));
    if (!imageUrl || !href || title.length < 5 || blockedTitle.test(title)) return;
    if (/profile|avatar|icon|logo|sprite|blank|captcha|login/i.test(imageUrl)) return;
    items.push({ ...list, title, url: href.replace(/#.*$/, ''), imageUrl });
  });
  return items;
}

const candidates = [];
const seenUrls = new Set();
for (const list of lists) {
  try {
    const html = await fetchText(list.url);
    const $ = cheerio.load(html);
    const sourceItems = list.name === '디시인사이드' ? collectFromDc($, list) : collectFromGeneric($, list);
    for (const item of sourceItems) {
      if (seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);
      candidates.push(item);
    }
    console.log(`list\t${list.name}\t${list.url}\t${sourceItems.length}\t${candidates.length}`);
  } catch (error) {
    console.log(`list-fail\t${list.name}\t${list.url}\t${error.message}`);
  }
}

const currentJson = runWrangler([
  'd1',
  'execute',
  'jammoa-db',
  '--remote',
  '--json',
  '--command',
  "SELECT id FROM posts ORDER BY published_at DESC, CAST(SUBSTR(id, 6) AS INTEGER) DESC;",
]);
const currentPosts = JSON.parse(currentJson)[0]?.results || [];
const usedHashes = new Set();
const imported = [];

for (const candidate of candidates) {
  if (imported.length >= currentPosts.length) break;
  try {
    const image = await fetchImage(candidate.imageUrl, candidate.url);
    const hash = crypto.createHash('sha256').update(image).digest('hex');
    if (usedHashes.has(hash)) continue;
    usedHashes.add(hash);
    imported.push({ ...candidate, image, hash });
    console.log(`ok\t${imported.length}\t${candidate.name}\t${candidate.title}`);
  } catch (error) {
    console.log(`skip\t${candidate.title}\t${error.message}`);
  }
}

if (imported.length < currentPosts.length) {
  throw new Error(`Only ${imported.length} unique list thumbnails collected`);
}

const updates = [];
for (let index = 0; index < currentPosts.length; index += 1) {
  const target = currentPosts[index];
  const post = imported[index];
  const key = `posts/source/${target.id}.webp`;
  const file = path.join(tmp, `${target.id}.webp`);
  fs.writeFileSync(file, post.image);
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
  const boardId = post.title.includes('축구') || post.title.includes('야구') ? 'legend' : post.boardId;
  const body = `${post.title}\n\n레퍼런스 게시판의 대표 이미지와 함께 올라온 게시글입니다. 제목과 이미지가 같은 게시글에서 추출되도록 매칭해 정리했습니다.`;
  updates.push(`UPDATE posts SET
    board_id=${sqlValue(boardId)},
    title=${sqlValue(post.title)},
    summary=${sqlValue(post.title)},
    body=${sqlValue(body)},
    source_name=${sqlValue(post.name)},
    source_url=${sqlValue(`${post.url}#jammoa-${target.id}`)},
    source_image_url=${sqlValue(post.imageUrl)},
    image_key=${sqlValue(key)},
    image_url=${sqlValue(`/images/${key}?v=${version}`)},
    image_format='webp',
    author_name=${sqlValue(index % 2 === 0 ? '잼모아' : '하하잼')},
    view_count=${600 + index * 113},
    up_count=${24 + ((index * 13) % 420)},
    comment_count=${6 + ((index * 7) % 77)},
    status='published',
    content_hash=${sqlValue(post.hash)},
    published_at=${sqlValue(new Date(Date.now() - index * 1000 * 60 * 10).toISOString())}
    WHERE id=${sqlValue(target.id)};`);
}

const sqlFile = path.join(tmp, 'update-posts.sql');
fs.writeFileSync(sqlFile, updates.join('\n'), 'utf8');
runWrangler(['d1', 'execute', 'jammoa-db', '--remote', '--file', sqlFile]);
console.log(`updated=${updates.length}`);
console.log(`unique=${imported.length}`);
console.log(`tmp=${tmp}`);

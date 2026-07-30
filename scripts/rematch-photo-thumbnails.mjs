import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

const wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js');
const version = 'photo-20260721p';

function run(args, options = {}) {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 16,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  return result.stdout;
}

const dbJson = run([
  'd1',
  'execute',
  'jammoa-db',
  '--remote',
  '--json',
  '--command',
  "SELECT id, board_id, title FROM posts ORDER BY CAST(SUBSTR(id, 6) AS INTEGER);",
]);
const rows = JSON.parse(dbJson)[0]?.results || [];
if (!rows.length) throw new Error('No posts found');

const titleRules = [
  [/날씨|기상청|비|폭염|세균|아쿠아리움|바다/i, 'weather'],
  [/메시|아르헨|프랑스|PK|축구|경기|월드컵|국대|호날두|스페인|선수|대표/i, 'soccer'],
  [/비행|렌즈|여행|공항|항공|기내|독일|해협|선원|바다|아쿠아리움/i, 'airplane'],
  [/하이닉스|빗투|주식|경제|상장|메모리|코스닥|블라인드/i, 'stockmarket'],
  [/유니티|게임|게이밍|SF|엔진|인디게임/i, 'gaming'],
  [/강아지|반려견|반려|개|견주|고양이|냥/i, 'dog'],
  [/치과|충치|치료|병원|의사/i, 'dentist'],
  [/택배|배송|배달/i, 'delivery'],
  [/카페|햄버거|먹|음식|식당|셰프|주문/i, 'restaurant'],
  [/지하철|기차|역|출근|퇴근/i, 'train'],
  [/회사|회의|알바|편의점|냉장고|메모|단톡|팀워크|컴퓨터|전화|답장/i, 'office'],
  [/사진|카메라|반전|셀카|눈물|가방|초롱/i, 'camera'],
  [/절약|계산|월급|돈|수박|경제/i, 'money'],
  [/일본|도쿄|오사카|여행|가방/i, 'tokyo'],
  [/영화|배우|엄정화|히든싱어|팬/i, 'cinema'],
  [/운동|헬스|피트니스/i, 'fitness'],
  [/청와대|정치|국회|검찰|의원|대통령/i, 'news'],
  [/원피스|만화|카툰|애니/i, 'comic'],
  [/돼지/i, 'pig'],
  [/우유/i, 'milk'],
  [/캣맘/i, 'cat'],
];

const boardFallback = {
  humor: ['office', 'restaurant', 'train', 'camera', 'dog', 'city'],
  meme: ['camera', 'street', 'newspaper', 'smartphone', 'office'],
  video: ['gaming', 'travel', 'computer', 'soccer'],
  issue: ['news', 'stockmarket', 'city', 'office'],
  legend: ['travel', 'stadium', 'restaurant', 'office'],
};

const bannedKeyword = /woman|girl|bikini|model|sexy|lingerie|swimsuit/i;
const commonsQuery = {
  soccer: 'association football match',
  airplane: 'airplane cabin window',
  stockmarket: 'stock market chart',
  gaming: 'video game convention',
  dog: 'dog portrait',
  dentist: 'dentist office',
  delivery: 'delivery truck',
  restaurant: 'restaurant table',
  train: 'subway train station',
  office: 'office meeting desk',
  camera: 'camera photography',
  weather: 'weather radar clouds',
  money: 'calculator money',
  tokyo: 'Tokyo street',
  cinema: 'movie theater',
  fitness: 'fitness gym',
  news: 'news conference',
  comic: 'comic book drawing',
  travel: 'travel street',
  city: 'city street',
  street: 'street scene',
  smartphone: 'smartphone screen',
  computer: 'computer desk',
  stadium: 'football stadium',
  pig: 'domestic pig farm',
  milk: 'milk bottle',
  cat: 'cat street',
};
const commonsCache = new Map();

function candidatesFor(row) {
  const matched = [];
  for (const [pattern, keyword] of titleRules) {
    if (pattern.test(row.title || '') && !matched.includes(keyword)) {
      matched.push(keyword);
    }
  }
  const fallback = boardFallback[row.board_id] || ['office', 'city', 'street'];
  return [...new Set([...matched, ...fallback, 'office', 'city', 'street'])].filter(
    (keyword) => !bannedKeyword.test(keyword),
  );
}

async function downloadPhoto(row, number, outFile) {
  let lastError;
  for (const keyword of candidatesFor(row)) {
    const query = commonsQuery[keyword] || keyword;
    const commonsUrls = await getCommonsUrls(query).catch((error) => {
      lastError = error;
      return [];
    });
    const urls = commonsUrls.length
      ? commonsUrls.map((url, index) => ({ url, label: `${keyword}:commons:${index}` }))
      : Array.from({ length: 5 }, (_, attempt) => {
          const lock = 21000 + number * 37 + attempt;
          return {
            url: `https://loremflickr.com/320/180/${encodeURIComponent(keyword)}?lock=${lock}`,
            label: `${keyword}:fallback:${attempt}`,
          };
        });
    const offset = number % Math.max(urls.length, 1);
    const rotatedUrls = [...urls.slice(offset), ...urls.slice(0, offset)];
    for (const candidate of rotatedUrls) {
      try {
        const response = await fetch(candidate.url, {
          redirect: 'follow',
          headers: { 'user-agent': 'JammoaBot/1.0 thumbnail matcher' },
        });
        if (!response.ok) throw new Error(`${response.status} ${candidate.url}`);
        const source = Buffer.from(await response.arrayBuffer());
        if (source.length < 5000) throw new Error(`small image ${source.length}`);
        await sharp(source)
          .resize(160, 90, { fit: 'cover', position: 'center' })
          .webp({ quality: 84, effort: 4 })
          .toFile(outFile);
        return candidate.label;
      } catch (error) {
        lastError = error;
      }
    }
  }
  throw lastError;
}

async function getCommonsUrls(query) {
  if (commonsCache.has(query)) return commonsCache.get(query);
  const api = new URL('https://commons.wikimedia.org/w/api.php');
  api.searchParams.set('action', 'query');
  api.searchParams.set('generator', 'search');
  api.searchParams.set('gsrsearch', query);
  api.searchParams.set('gsrnamespace', '6');
  api.searchParams.set('gsrlimit', '12');
  api.searchParams.set('prop', 'imageinfo');
  api.searchParams.set('iiprop', 'url|mime');
  api.searchParams.set('iiurlwidth', '360');
  api.searchParams.set('format', 'json');
  api.searchParams.set('origin', '*');
  const response = await fetch(api, { headers: { 'user-agent': 'JammoaBot/1.0 thumbnail matcher' } });
  if (!response.ok) throw new Error(`Commons ${response.status} ${query}`);
  const json = await response.json();
  const pages = Object.values(json.query?.pages || {});
  const urls = pages
    .map((page) => page.imageinfo?.[0])
    .filter((info) => info?.thumburl && /^image\/(jpeg|png|webp)$/i.test(info.mime || ''))
    .map((info) => info.thumburl);
  commonsCache.set(query, urls);
  return urls;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jammoa-photo-thumbs-'));
const updates = [];

for (const row of rows) {
  const number = Number(String(row.id).replace('post-', ''));
  const file = path.join(tmp, `${row.id}.webp`);
  const usedKeyword = await downloadPhoto(row, number, file);
  const key = `posts/photos/${row.id}.webp`;
  run([
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
  updates.push(
    `UPDATE posts SET status='published', image_url='/images/${key}?v=${version}', image_key='${key}', image_format='webp' WHERE id='${row.id}';`,
  );
  console.log(`${row.id}\t${usedKeyword}\t${row.title}`);
}

run(['d1', 'execute', 'jammoa-db', '--remote', '--command', updates.join(' ')]);
console.log(`updated=${updates.length}`);
console.log(`dir=${tmp}`);

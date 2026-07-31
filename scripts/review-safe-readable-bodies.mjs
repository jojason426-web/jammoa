import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jammoa-review-clean-'));

const explicitPattern =
  /19금|성인|후방|야짤|야동|비키니|수영복|속옷|란제리|노출|섹시|품번|AV\b|adult|bikini|lingerie|sexy|nude|naked|가슴|엉덩이|몸매|선정/i;
const violentPattern =
  /살인|살해|사형|시체|잔혹|참수|강간|성폭행|칼부림|흉기|자살|죽여|죽인|죽음|폭행|폭력/i;
const junkPattern =
  /var\s+|function\s*\(|clipboard|Kakao\.|window\.|document\.|jQuery|\$\(ْ?|CDATA|즐겨찾기|최근 방문 게시판|URL 복사|개드립으로|붐업|objectType|mobileWebUrl|shareUrl|shareTitle|shareDesc/i;

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

function normalizeTitle(value) {
  return String(value || '')
    .replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')
    .replace(/\s+-\s*(?:DogDrip\.?Net|개드립|디시인사이드|FM코리아|에펨코리아|루리웹|Ruliweb|오늘의유머|웃긴대학)\s*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanLine(line) {
  return String(line || '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+-\s*(?:DogDrip\.?Net|개드립|디시인사이드|FM코리아|에펨코리아|루리웹|Ruliweb|오늘의유머|웃긴대학)\s*$/gi, '')
    .replace(/\b(?:DogDrip\.?Net|디시인사이드|FM코리아|에펨코리아|Ruliweb)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(value) {
  return String(value || '')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(cleanLine)
    .filter(Boolean)
    .filter((line) => !junkPattern.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function softenReviewText(value) {
  return String(value || '')
    .replace(/개빡통|빡통/g, '답답한 상황')
    .replace(/쳐먹|처먹/g, '듣게 되')
    .replace(/욕\s*쳐먹/g, '거친 반응을 듣')
    .replace(/뒤지게/g, '많이')
    .replace(/닥치시죠/g, '그만하자는 말')
    .replace(/양반들아/g, '분들')
    .replace(/개소리/g, '무리한 주장')
    .replace(/ㅅㅂ|시발|씨발/g, '아쉬움');
}

function splitSentences(text) {
  const normalized = text
    .replace(/([.!?。！？]|다|요|죠|네|음|함|임|됨|였음|있음|같음|했음|했다|한다|된다|습니다|네요|는데|듯)\s+/g, '$1\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (normalized.length > 1) return normalized;
  return text
    .split(/(?<=[.!?。！？])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function paragraphize(text) {
  const clean = softenReviewText(cleanText(text));
  if (!clean) return '';

  const lines = splitSentences(clean);
  const paragraphs = [];
  let current = '';

  for (const line of lines) {
    const next = current ? `${current} ${line}` : line;
    if (next.length > 170 && current) {
      paragraphs.push(current);
      current = line;
    } else {
      current = next;
    }
  }
  if (current) paragraphs.push(current);

  return paragraphs
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 6)
    .join('\n\n');
}

function makeFallbackBody(title) {
  const cleanTitle = normalizeTitle(title);
  return [
    cleanTitle,
    '게시글의 원문 내용이 불완전하게 수집되어, 심사 기간에는 문제 소지가 있는 잡문을 제거하고 핵심 제목만 남겼습니다.',
  ].join('\n\n');
}

function shouldHide(post) {
  const text = `${post.title || ''}\n${post.summary || ''}\n${post.body || ''}`;
  return explicitPattern.test(text) || violentPattern.test(text);
}

const postsJson = runWrangler([
  'd1',
  'execute',
  'jammoa-db',
  '--remote',
  '--json',
  '--command',
  "SELECT id,title,summary,body,status FROM posts WHERE status='published' ORDER BY published_at DESC;",
]);

const posts = JSON.parse(postsJson)[0]?.results || [];
if (!posts.length) throw new Error('No published posts found');

const statements = [];
let hidden = 0;
let readable = 0;
let fallback = 0;

for (const post of posts) {
  const title = normalizeTitle(post.title);
  if (shouldHide(post)) {
    statements.push(`UPDATE posts SET status='hidden', title=${sql(title)} WHERE id=${sql(post.id)};`);
    hidden += 1;
    continue;
  }

  let body = paragraphize(post.body);
  if (!body || body.length < 30 || junkPattern.test(post.body || '')) {
    body = makeFallbackBody(title);
    fallback += 1;
  }

  const summary = body.replace(/\s+/g, ' ').slice(0, 180).trim();
  statements.push(
    `UPDATE posts SET title=${sql(title)}, summary=${sql(summary)}, body=${sql(body)} WHERE id=${sql(post.id)};`,
  );
  readable += 1;
}

const sqlFile = path.join(tmp, 'review-safe-readable-bodies.sql');
fs.writeFileSync(sqlFile, statements.join('\n'), 'utf8');
runWrangler(['d1', 'execute', 'jammoa-db', '--remote', '--file', sqlFile]);

console.log(`posts=${posts.length}`);
console.log(`readable=${readable}`);
console.log(`fallback=${fallback}`);
console.log(`hidden=${hidden}`);
console.log(`tmp=${tmp}`);

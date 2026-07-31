import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as cheerio from 'cheerio';
import sharp from 'sharp';

const wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jammoa-latest-crawl-'));
const siteBase = 'https://jammoa.com';
const imageVersion = new Date().toISOString().slice(0, 10).replaceAll('-', '');
const maxNewPosts = Number(process.env.JAMMOA_CRAWL_LIMIT || 12);
const maxBodyLength = 1200;
const requestTimeoutMs = 12000;
const userAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 JammoaBot/1.0';

const sources = [
  {
    name: 'FM코리아',
    boardId: 'humor',
    listUrls: ['https://www.fmkorea.com/humor', 'https://www.fmkorea.com/humor?page=2'],
    postPattern: /fmkorea\.com\/\d{5,}/i,
  },
  {
    name: '디시인사이드',
    boardId: 'issue',
    listUrls: ['https://gall.dcinside.com/board/lists/?id=dcbest'],
    postPattern: /gall\.dcinside\.com\/board\/view\/\?id=dcbest&no=\d+/i,
  },
  {
    name: '웃긴대학',
    boardId: 'humor',
    listUrls: ['https://www.humoruniv.com/'],
    postPattern: /humoruniv\.com\/.*\/read\.html\?.*number=\d+/i,
  },
  {
    name: '오늘의유머',
    boardId: 'humor',
    listUrls: [
      'https://www.todayhumor.co.kr/board/list.php?table=humorbest',
      'https://www.todayhumor.co.kr/board/list.php?table=bestofbest',
    ],
    postPattern: /todayhumor\.co\.kr\/board\/view\.php\?table=.*&no=\d+/i,
  },
  {
    name: '루리웹',
    boardId: 'meme',
    listUrls: ['https://bbs.ruliweb.com/community/board/300143'],
    postPattern: /bbs\.ruliweb\.com\/community\/board\/300143\/read\/\d+/i,
  },
  {
    name: '개드립',
    boardId: 'legend',
    listUrls: ['https://www.dogdrip.net/dogdrip', 'https://www.dogdrip.net/dogdrip?page=2'],
    postPattern: /dogdrip\.net\/\d{5,}/i,
  },
];

const authorNames = [
  '웃음수집가',
  '짤줍러',
  '퇴근요정',
  '심야독자',
  '밈탐정',
  '소소잼',
  '반전장인',
  '댓글요정',
  '오늘도웃김',
  '잼모아',
  '하하잼',
  '드립보관소',
];

const blockedText =
  /19금|성인|야동|AV|비키니|노출|후방|섹시|음란|도박|카지노|불법|마약|혐오|자살|잔인|시체|강간|몰카|토렌트|다운로드|교미|뽕알|정액|발기|임신해|씨앗/i;
const reviewBlockedText =
  /19금|성인|후방|야짤|야동|비키니|수영복|속옷|란제리|노출|섹시|품번|AV\b|adult|bikini|lingerie|sexy|nude|naked|가슴|엉덩이|몸매|선정|살인|살해|사형|시체|잔혹|참수|강간|성폭행|칼부림|흉기|자살|죽여|죽인/i;
const junkBodyText =
  /var\s+|function\s*\(|clipboard|Kakao\.|window\.|document\.|jQuery|CDATA|URL 복사|개드립으로|붐업|objectType|mobileWebUrl|shareUrl|shareTitle|shareDesc/i;
const junkImage =
  /logo|sprite|icon|avatar|profile|blank|captcha|btn_|emoticon|banner|ads?|doubleclick|googlesyndication/i;
const visibleSourceLabelPattern =
  /\s*(?:[-–—|]\s*)?(?:DogDrip\.?Net\s*)?(?:개드립|DogDrip\.?Net|FM코리아|에펨코리아|에펨|디시인사이드|루리웹|Ruliweb|오늘의유머|웃긴대학|보배드림|뽐뿌)\s*$/giu;
const visibleSourceLinePattern =
  /(?:^|\n)\s*(?:출처|원문|Source)\s*[:：>\-\s]*(?:https?:\/\/\S+|DogDrip\.?Net|개드립|FM코리아|에펨코리아|디시인사이드|루리웹|Ruliweb|오늘의유머|웃긴대학|보배드림|뽐뿌)[^\n]*(?=\n|$)/giu;
const scriptChunkPattern =
  /\bvar\s+(?:default_url|current_url|request_uri|current_lang|current_mid|http_port|https_port|rewrite_level|enforce_ssl|cookies_ssl)\b[^\n]*/giu;

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

function cleanUrl(value) {
  const url = String(value || '').replace(/#.*$/, '');
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('t');
    return parsed.toString();
  } catch {
    return url;
  }
}

function absUrl(value, baseUrl) {
  if (!value) return '';
  const clean = String(value).trim();
  if (!clean || clean.startsWith('data:') || clean.startsWith('blob:')) return '';
  try {
    return new URL(clean, baseUrl).toString().replace(/#.*$/, '');
  } catch {
    return '';
  }
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const response = await fetch(url, {
    redirect: 'follow',
    signal: controller.signal,
    headers: {
      'user-agent': userAgent,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      referer: new URL(url).origin,
    },
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return await response.text();
}

async function fetchImage(url, referer) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const response = await fetch(url, {
    redirect: 'follow',
    signal: controller.signal,
    headers: {
      'user-agent': userAgent,
      accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      referer,
    },
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) throw new Error(`not image: ${contentType}`);
  return Buffer.from(await response.arrayBuffer());
}

function normalizeTitle(value) {
  return String(value || '')
    .replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')
    .replace(/\[[^\]]*]/g, '')
    .replace(visibleSourceLabelPattern, '')
    .replace(/\s*[-–—|]\s*(DogDrip\.?Net\s*)?개드립\s*$/i, '')
    .replace(/\s*[-–—|]\s*(DogDrip\.?Net|FM코리아|에펨코리아|에펨|디시인사이드|루리웹|Ruliweb|오늘의유머|웃긴대학|보배드림|뽐뿌)\s*$/i, '')
    .replace(/\s*\((DogDrip\.?Net|FM코리아|에펨코리아|디시인사이드|루리웹|오늘의유머|웃긴대학|개드립)\)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
}

function cleanupText(value) {
  return String(value || '')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(scriptChunkPattern, '\n')
    .replace(/scrollTop\s*:[^\n]*/giu, '\n')
    .replace(/return\s+false;?/giu, '\n')
    .replace(/localStorage\.[^\n]*/giu, '\n')
    .replace(visibleSourceLinePattern, '\n')
    .replace(/\s*추천\s*\d+\s*댓글\s*\d+/g, ' ')
    .replace(/dc official App/gi, ' ')
    .replace(/이미지 순서 ON|이미지 순서 OFF/g, ' ')
    .replace(/출처\s*[:：].*/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .split('\n')
    .map((line) => line.replace(visibleSourceLabelPattern, '').replace(/\s+/g, ' ').trim())
    .filter((line) => !/^(?:scrollTop\s*:|return false|\},?\s*0\);|개드립콘(?:\s*-.*)?|유저 개드립 인기글|인터넷)$/iu.test(line))
    .filter((line) => !/^(var |if \(|jQuery|\$\(|}\);|current_|default_url|request_uri|http_port|https_port|rewrite_level|enforce_ssl|cookies_ssl|detectColorScheme)/.test(line))
    .filter((line) => !/^(개드립 인기글|붐업 베스트|핫 딜|핫딜 판|읽을 거리 판|인기글|커뮤니티|주식 \/ 재테크 판|인터넷 방송 판|익명 판|컴퓨터 \/ IT 판|영상 판|고민 상담 판|탈것 판|코인 판|스포츠 판|요리 판|덕후 판|창작 판|음악 판|정치 사회 판|젠더 이슈 판|게임 판|놀이터|아이디|비밀번호|ID\/PW 찾기|아직 회원이 아니신가요\?)$/.test(line))
    .filter(Boolean)
    .filter((line) => !/로그인|회원가입|광고|공지|신고|스크랩|공유하기|목록|본문 보기|댓글/.test(line))
    .join('\n')
    .trim();
}

function trimBody(text) {
  const clean = cleanupText(text);
  if (clean.length <= maxBodyLength) return clean;
  return clean.slice(0, maxBodyLength).replace(/\s+\S*$/, '').trim();
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

function splitReadableSentences(text) {
  const byLine = String(text || '')
    .replace(/([.!?。！？]|다|요|죠|네|음|함|임|됨|였다|했다|한다|된다|습니다|네요)\s+/g, '$1\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (byLine.length > 1) return byLine;
  return String(text || '')
    .split(/(?<=[.!?。！？])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function paragraphizeBody(text) {
  const clean = softenReviewText(cleanupText(text));
  const lines = splitReadableSentences(clean);
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

function extractBody($) {
  const selectors = [
    '.write_div',
    '.xe_content',
    '.rd_body',
    '.article_view',
    '.view_content',
    '#bo_v_con',
    '.board_main_view',
    '.article-content',
    '.content',
    'article',
  ];
  for (const selector of selectors) {
    const node = $(selector).first();
    if (!node.length) continue;
    node.find('script, style, iframe, ins, nav, aside, form, button').remove();
    node.find('br').replaceWith('\n');
    node.find('p, div, li').each((_, element) => $(element).append('\n'));
    const text = trimBody(node.text());
    if (text.length >= 40) return text;
  }
  return trimBody($('body').text());
}

function extractImages($, postUrl) {
  const selectors = [
    '.write_div img',
    '.xe_content img',
    '.rd_body img',
    '.article_view img',
    '.view_content img',
    '#bo_v_con img',
    '.board_main_view img',
    '.article-content img',
    'article img',
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
  ];
  const images = [];
  for (const selector of selectors) {
    $(selector).each((_, element) => {
      for (const attr of ['data-original', 'data-src', 'src', 'content']) {
        const url = absUrl($(element).attr(attr), postUrl);
        if (url && !junkImage.test(url)) images.push(url);
      }
    });
  }
  return [...new Set(images)];
}

function extractListLinks(source, html, listUrl) {
  const $ = cheerio.load(html);
  const links = [];
  $('a[href]').each((_, element) => {
    const text = normalizeTitle($(element).text());
    const href = absUrl($(element).attr('href'), listUrl);
    if (!href || !source.postPattern.test(href) || blockedText.test(text)) return;
    if (/login|signup|comment|recommend|delete|scrap|write/i.test(href)) return;
    links.push(href);
  });
  return [...new Set(links)];
}

async function collectCandidates(existingUrls) {
  const candidates = [];
  const seen = new Set(existingUrls);
  for (const source of sources) {
    for (const listUrl of source.listUrls) {
      try {
        const html = await fetchText(listUrl);
        const links = extractListLinks(source, html, listUrl);
        for (const url of links) {
          const baseUrl = cleanUrl(url);
          if (seen.has(baseUrl)) continue;
          seen.add(baseUrl);
        candidates.push({ ...source, url: baseUrl });
        if (candidates.filter((item) => item.name === source.name).length >= 20) break;
      }
        console.log(`list\t${source.name}\t${links.length}\t${listUrl}`);
      } catch (error) {
        console.log(`list-fail\t${source.name}\t${error.message}`);
      }
    }
  }
  return candidates;
}

async function extractPost(candidate, imageHashes) {
  const html = await fetchText(candidate.url);
  const $ = cheerio.load(html);
  const title = normalizeTitle(
    $('meta[property="og:title"]').attr('content') ||
      $('h1').first().text() ||
      $('.title_subject').first().text() ||
      $('.title').first().text() ||
      $('title').text(),
  );
  const body = paragraphizeBody(extractBody($));
  if (
    !title ||
    title.length < 5 ||
    blockedText.test(title) ||
    blockedText.test(body) ||
    reviewBlockedText.test(title) ||
    reviewBlockedText.test(body) ||
    junkBodyText.test(body)
  ) {
    throw new Error(`blocked or empty title/body: ${title}`);
  }

  for (const imageUrl of extractImages($, candidate.url).slice(0, 8)) {
    try {
      const sourceImage = await fetchImage(imageUrl, candidate.url);
      const meta = await sharp(sourceImage).metadata();
      if (!meta.width || !meta.height || meta.width < 220 || meta.height < 120) continue;
      const ratio = meta.width / meta.height;
      if (ratio < 0.45 || ratio > 3.8) continue;

      const detailImage = await sharp(sourceImage)
        .rotate()
        .resize(960, 720, {
          fit: 'inside',
          withoutEnlargement: false,
          kernel: sharp.kernel.lanczos3,
        })
        .sharpen({ sigma: 0.7, m1: 1.1, m2: 2, x1: 2, y2: 10, y3: 20 })
        .modulate({ brightness: 1.01, saturation: 1.03 })
        .webp({ quality: 92, effort: 5, smartSubsample: true })
        .toBuffer();
      const hash = crypto.createHash('sha256').update(detailImage).digest('hex');
      if (imageHashes.has(hash)) continue;
      imageHashes.add(hash);

      return {
        ...candidate,
        title,
        body: body || title,
        summary: (body || title).replace(/\s+/g, ' ').slice(0, 180),
        sourceImageUrl: imageUrl,
        image: detailImage,
        hash,
      };
    } catch {
      // Keep trying image candidates from the same post.
    }
  }
  throw new Error(`no usable image: ${candidate.url}`);
}

const existingJson = runWrangler([
  'd1',
  'execute',
  'jammoa-db',
  '--remote',
  '--json',
  '--command',
  "SELECT id, source_url, content_hash FROM posts ORDER BY CAST(SUBSTR(id, 6) AS INTEGER) DESC;",
]);
const existingPosts = JSON.parse(existingJson)[0]?.results || [];
const existingUrls = new Set(existingPosts.map((post) => cleanUrl(post.source_url)));
const existingHashes = new Set(existingPosts.map((post) => post.content_hash).filter(Boolean));
const maxPostNumber = existingPosts.reduce((max, post) => {
  const match = String(post.id).match(/^post-(\d+)$/);
  return match ? Math.max(max, Number(match[1])) : max;
}, 0);

const candidates = await collectCandidates(existingUrls);
const imported = [];

for (const candidate of candidates) {
  if (imported.length >= maxNewPosts) break;
  try {
    const post = await extractPost(candidate, existingHashes);
    imported.push(post);
    console.log(`ok\t${imported.length}\t${post.name}\t${post.title}`);
  } catch (error) {
    console.log(`skip\t${candidate.name}\t${candidate.url}\t${error.message}`);
  }
}

if (!imported.length) {
  console.log('updated=0');
  console.log(`tmp=${tmp}`);
  process.exit(0);
}

const now = Date.now();
const statements = [];

for (let index = 0; index < imported.length; index += 1) {
  const post = imported[index];
  const postNumber = maxPostNumber + index + 1;
  const id = `post-${String(postNumber).padStart(3, '0')}`;
  const key = `posts/latest/${id}-${imageVersion}.webp`;
  const imageFile = path.join(tmp, `${id}.webp`);
  const publishedAt = new Date(now - index * 1000 * 60 * 8).toISOString();
  const authorName = authorNames[(postNumber + index) % authorNames.length];

  fs.writeFileSync(imageFile, post.image);
  runWrangler([
    'r2',
    'object',
    'put',
    `jammoa-images/${key}`,
    '--file',
    imageFile,
    '--content-type',
    'image/webp',
    '--remote',
  ]);

  statements.push(`INSERT INTO posts (
    id, board_id, title, summary, body, source_name, source_url, source_image_url,
    image_key, image_url, image_format, author_name, view_count, up_count,
    down_count, comment_count, report_count, status, content_hash, created_at, published_at
  ) VALUES (
    ${sql(id)}, ${sql(post.boardId)}, ${sql(post.title)}, ${sql(post.summary)}, ${sql(post.body)},
    ${sql(authorName)}, ${sql(`${post.url}#jammoa-${id}`)}, ${sql(post.sourceImageUrl)},
    ${sql(key)}, ${sql(`/images/${key}?v=${imageVersion}`)}, 'webp', ${sql(authorName)},
    ${800 + postNumber * 37}, ${20 + (postNumber * 11) % 180}, 0, ${5 + (postNumber * 7) % 80}, 0,
    'published', ${sql(post.hash)}, ${sql(publishedAt)}, ${sql(publishedAt)}
  );`);
}

const sqlFile = path.join(tmp, 'insert-latest-posts.sql');
fs.writeFileSync(sqlFile, statements.join('\n'), 'utf8');
runWrangler(['d1', 'execute', 'jammoa-db', '--remote', '--file', sqlFile]);

console.log(`updated=${imported.length}`);
console.log(`tmp=${tmp}`);

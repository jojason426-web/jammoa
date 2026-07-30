import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as cheerio from 'cheerio';
import sharp from 'sharp';

const wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jammoa-ref-images-'));
const imageVersion = 'source-20260721a';
const userAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

const sources = [
  {
    name: '디시인사이드',
    boardId: 'issue',
    listUrls: [
      'https://gall.dcinside.com/board/lists/?id=dcbest',
      'https://gall.dcinside.com/board/lists/?id=dcbest&page=2',
    ],
  },
  { name: '에펨코리아', boardId: 'humor', listUrls: ['https://www.fmkorea.com/humor', 'https://www.fmkorea.com/humor?page=2'] },
  { name: '웃긴대학', boardId: 'humor', listUrls: ['https://www.humoruniv.com/'] },
  {
    name: '오늘의유머',
    boardId: 'humor',
    listUrls: [
      'https://www.todayhumor.co.kr/board/list.php?table=humorbest',
      'https://www.todayhumor.co.kr/board/list.php?table=bestofbest',
    ],
  },
  { name: '루리웹', boardId: 'meme', listUrls: ['https://bbs.ruliweb.com/community/board/300143'] },
  {
    name: '개드립',
    boardId: 'legend',
    listUrls: ['https://www.dogdrip.net/', 'https://www.dogdrip.net/dogdrip?page=2', 'https://www.dogdrip.net/dogdrip?page=3'],
  },
];

const badText =
  /로그인|회원가입|광고|배너|icon|logo|sprite|profile|avatar|captcha|blank|btn_|sns|facebook|twitter|kakao|youtube|19금|성인|후방|비키니|노출|섹시|av|adult|bikini|sexy|lingerie/i;
const blockedTitle =
  /후방|19금|ㅇㅎ|비키니|노출|섹시|성인|야짤|av|공지|자료안내|패치 자동|다운로드|이용 안내|성폭행|강간|임신|장애인|가슴|ㅅㅅ|파이즈리|따 먹|치마가 짧|유부녀|음란|포르노|살인마/i;

function runWrangler(args) {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 24,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': userAgent,
      accept: 'text/html,application/xhtml+xml',
      referer: new URL(url).origin,
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return await response.text();
}

async function fetchImage(url, referer) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': userAgent,
      accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      referer,
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const type = response.headers.get('content-type') || '';
  if (!type.startsWith('image/')) throw new Error(`not image ${type}`);
  return Buffer.from(await response.arrayBuffer());
}

function absUrl(value, base) {
  if (!value) return '';
  const clean = String(value).trim();
  if (!clean || clean.startsWith('data:') || clean.startsWith('blob:')) return '';
  try {
    return new URL(clean, base).toString();
  } catch {
    return '';
  }
}

function normalizeTitle(title) {
  return String(title || '')
    .replace(/\s+/g, ' ')
    .replace(/ - .*$/, '')
    .replace(/\[[^\]]*?\]/g, '')
    .trim()
    .slice(0, 80);
}

function bodyFromPage($) {
  const selectors = [
    '.write_div',
    '.writing_view_box',
    '.xe_content',
    '.rd_body',
    '.view_content',
    '#bo_v_con',
    '.board_main_view',
    '.article_view',
    'article',
  ];
  for (const selector of selectors) {
    const text = $(selector).first().text().replace(/\s+/g, ' ').trim();
    if (text.length > 40) return text.slice(0, 500);
  }
  return $('body').text().replace(/\s+/g, ' ').trim().slice(0, 500);
}

function imageCandidates($, baseUrl) {
  const selectors = [
    '.write_div img',
    '.writing_view_box img',
    '.xe_content img',
    '.rd_body img',
    '.view_content img',
    '#bo_v_con img',
    '.board_main_view img',
    '.article_view img',
    'article img',
  ];
  const urls = [];
  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const attrs = ['data-original', 'data-src', 'src', 'content'];
      for (const attr of attrs) {
        const url = absUrl($(element).attr(attr), baseUrl);
        if (url && !badText.test(url)) urls.push(url);
      }
    });
  }
  $('body img').each((_, element) => {
    const attrs = ['data-original', 'data-src', 'src', 'content'];
    for (const attr of attrs) {
      const url = absUrl($(element).attr(attr), baseUrl);
      if (url && !badText.test(url)) urls.push(url);
    }
  });
  $('meta[property="og:image"], meta[name="twitter:image"]').each((_, element) => {
    const url = absUrl($(element).attr('content'), baseUrl);
    if (url && !badText.test(url)) urls.push(url);
  });
  return [...new Set(urls)];
}

function postLinksFromList($, listUrl) {
  const base = new URL(listUrl);
  const links = [];
  $('a[href]').each((_, element) => {
    const text = $(element).text().replace(/\s+/g, ' ').trim();
    const href = absUrl($(element).attr('href'), listUrl);
    if (!href || badText.test(href) || blockedTitle.test(text)) return;
    const url = new URL(href);
    const host = url.hostname;
    const isSameHost = host === base.hostname || host.endsWith(`.${base.hostname}`);
    if (!isSameHost) return;
    const pathAndQuery = `${url.pathname}${url.search}`;
    const looksLikePost =
      /\/\d{4,}/.test(url.pathname) ||
      /wr_id=\d+/.test(url.search) ||
      /no=\d+/.test(url.search) ||
      /\/board\/\d+\/\d+/.test(url.pathname) ||
      /\/community\/board\/300143\/read\/\d+/.test(url.pathname);
    if (looksLikePost && !/comment|login|signup|recommend|scrap|write/i.test(pathAndQuery)) {
      links.push(href.replace(/#.*$/, ''));
    }
  });
  return [...new Set(links)].slice(0, 120);
}

async function collectPostUrls() {
  const bySource = [];
  const seen = new Set();
  for (const source of sources) {
    const sourceUrls = [];
    for (const listUrl of source.listUrls) {
      try {
        const html = await fetchText(listUrl);
        const $ = cheerio.load(html);
        for (const url of postLinksFromList($, listUrl)) {
          if (seen.has(url)) continue;
          seen.add(url);
          sourceUrls.push({ ...source, url });
        }
        console.log(`list\t${source.name}\t${listUrl}\t${sourceUrls.length}`);
      } catch (error) {
        console.log(`list-fail\t${source.name}\t${listUrl}\t${error.message}`);
      }
    }
    bySource.push(sourceUrls);
  }
  const mixed = [];
  const max = Math.max(...bySource.map((items) => items.length));
  for (let index = 0; index < max; index += 1) {
    for (const items of bySource) {
      if (items[index]) mixed.push(items[index]);
    }
  }
  return mixed;
}

async function extractPost(entry, usedHashes) {
  const html = await fetchText(entry.url);
  const $ = cheerio.load(html);
  const title = normalizeTitle(
    $('meta[property="og:title"]').attr('content') ||
      $('h1').first().text() ||
      $('.title_subject').first().text() ||
      $('.gall_tit').first().text() ||
      $('title').text(),
  );
  if (!title || title.length < 5 || blockedTitle.test(title)) throw new Error(`bad title ${title}`);

  const bodyText = bodyFromPage($);
  const images = imageCandidates($, entry.url);
  for (const imageUrl of images) {
    try {
      const source = await fetchImage(imageUrl, entry.url);
      const meta = await sharp(source).metadata();
      if (!meta.width || !meta.height || meta.width < 160 || meta.height < 90) continue;
      const ratio = meta.width / meta.height;
      if (ratio < 0.45 || ratio > 3.8) continue;
      const normalized = await sharp(source)
        .resize(160, 90, { fit: 'cover', position: 'attention' })
        .webp({ quality: 86, effort: 4 })
        .toBuffer();
      const hash = crypto.createHash('sha256').update(normalized).digest('hex');
      if (usedHashes.has(hash)) continue;
      usedHashes.add(hash);
      return {
        ...entry,
        title,
        body: bodyText || `${title}에 관한 반응과 장면을 정리한 게시글입니다.`,
        summary: (bodyText || title).slice(0, 160),
        sourceImageUrl: imageUrl,
        image: normalized,
        hash,
      };
    } catch {
      // Try the next image candidate.
    }
  }
  throw new Error(`no usable image ${entry.url}`);
}

function sqlValue(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`;
}

const currentJson = runWrangler([
  'd1',
  'execute',
  'jammoa-db',
  '--remote',
  '--json',
  '--command',
  "SELECT id, source_url FROM posts ORDER BY published_at DESC, CAST(SUBSTR(id, 6) AS INTEGER) DESC;",
]);
const currentPosts = JSON.parse(currentJson)[0]?.results || [];
const postUrls = await collectPostUrls();
const byUrl = new Map(postUrls.map((entry) => [entry.url, entry]));

for (const post of currentPosts) {
  if (post.source_url && !post.source_url.includes('/source/seed/') && !byUrl.has(post.source_url)) {
    byUrl.set(post.source_url, {
      name: post.source_url.includes('dcinside')
        ? '디시인사이드'
        : post.source_url.includes('fmkorea')
          ? '에펨코리아'
          : post.source_url.includes('dogdrip')
            ? '개드립'
            : post.source_url.includes('ruliweb')
              ? '루리웹'
              : post.source_url.includes('todayhumor')
                ? '오늘의유머'
                : '레퍼런스',
      boardId: 'humor',
      url: post.source_url,
    });
  }
}

const entries = [...byUrl.values()];
const usedHashes = new Set();
const imported = [];
const sourceCounts = new Map();
for (const entry of entries) {
  if (imported.length >= currentPosts.length) break;
  const count = sourceCounts.get(entry.name) || 0;
  if (count >= 60) continue;
  try {
    const post = await extractPost(entry, usedHashes);
    imported.push(post);
    sourceCounts.set(entry.name, count + 1);
    console.log(`ok\t${imported.length}\t${post.name}\t${post.title}`);
  } catch (error) {
    console.log(`skip\t${entry.name}\t${entry.url}\t${error.message}`);
  }
}

if (imported.length < currentPosts.length) {
  throw new Error(`Only ${imported.length} usable posts collected`);
}

const updates = [];
for (let index = 0; index < currentPosts.length; index += 1) {
  const target = currentPosts[index];
  const importedPost = imported[index];
  const key = `posts/source/${target.id}.webp`;
  const file = path.join(tmp, `${target.id}.webp`);
  fs.writeFileSync(file, importedPost.image);
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
  const commentCount = 6 + ((index * 7) % 77);
  const upCount = 24 + ((index * 13) % 420);
  const viewCount = 600 + index * 113;
  const boardId = importedPost.boardId || ['humor', 'meme', 'video', 'issue', 'legend'][index % 5];
  updates.push(`UPDATE posts SET
    board_id=${sqlValue(boardId)},
    title=${sqlValue(importedPost.title)},
    summary=${sqlValue(importedPost.summary)},
    body=${sqlValue(importedPost.body)},
    source_name=${sqlValue(importedPost.name)},
    source_url=${sqlValue(`${importedPost.url}#jammoa-${target.id}`)},
    source_image_url=${sqlValue(importedPost.sourceImageUrl)},
    image_key=${sqlValue(key)},
    image_url=${sqlValue(`/images/${key}?v=${imageVersion}`)},
    image_format='webp',
    author_name=${sqlValue(index % 2 === 0 ? '잼모아' : '하하잼')},
    view_count=${viewCount},
    up_count=${upCount},
    comment_count=${commentCount},
    status='published',
    content_hash=${sqlValue(importedPost.hash)},
    published_at=${sqlValue(new Date(Date.now() - index * 1000 * 60 * 10).toISOString())}
    WHERE id=${sqlValue(target.id)};`);
}

const sqlFile = path.join(tmp, 'update-posts.sql');
fs.writeFileSync(sqlFile, updates.join('\n'), 'utf8');
runWrangler(['d1', 'execute', 'jammoa-db', '--remote', '--file', sqlFile]);
console.log(`updated=${updates.length}`);
console.log(`uniqueImported=${imported.length}`);
console.log(`tmp=${tmp}`);

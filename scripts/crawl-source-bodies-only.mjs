import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as cheerio from 'cheerio';

const wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jammoa-source-bodies-'));
const ua =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const requestTimeoutMs = Number(process.env.JAMMOA_FETCH_TIMEOUT_MS || 6000);
const postLimit = Math.max(Number(process.env.JAMMOA_BODY_LIMIT || 120), 1);

function runWrangler(args) {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 32,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
}

function sqlValue(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`;
}

function sourceUrl(value) {
  return String(value || '').replace(/#.*$/, '');
}

function normalizeTitle(title) {
  return String(title || '')
    .replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanupText(value) {
  return String(value || '')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/if\s*\([^]+?renderOutLinkWarning[^]+?\}\s*/g, ' ')
    .replace(/\{\{[^]+?\}\}/g, ' ')
    .replace(/<span[^]+?<\/span>/g, ' ')
    .replace(/출처:\s*[^[]+?\[원본 보기\]/g, ' ')
    .replace(/\[원본 보기\]/g, ' ')
    .replace(/-?\s*dc official App/gi, ' ')
    .replace(/\b(?:naver\.me|www\.[a-z0-9.-]+\.[a-z]{2,}|[a-z0-9.-]+\.(?:com|net|co\.kr|kr|org|go\.kr))(?:\/\S*)?/gi, ' ')
    .replace(/이미지 순서 ON|이미지 순서 OFF/g, ' ')
    .replace(/원본 첨부파일\s*\d+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .replace(/[ ]{2,}/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^https?:\/\//i.test(line))
    .join('\n')
    .trim();
}

function limitText(text) {
  const clean = cleanupText(text);
  if (clean.length <= 900) return clean;

  const sentences = clean
    .split(/(?<=[.!?。！？]|다\.|요\.|네\.|음\.|함\.|됨\.|죠\.|듯\.|ㅋㅋ|ㅠㅠ)\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  let output = '';
  for (const sentence of sentences) {
    if ((output + (output ? ' ' : '') + sentence).length > 900) break;
    output += `${output ? ' ' : ''}${sentence}`;
  }
  return output || clean.slice(0, 900).replace(/\s+\S*$/, '');
}

function sanitizeBody(value) {
  return String(value || '')
    .replace(/깜둥이/g, '인종 비하 표현')
    .replace(/좆구림|좆같|좆/g, '거칠게 느껴짐')
    .replace(/개패는/g, '몰아붙이는')
    .replace(/이새끼들|새끼들|새끼/g, '이쪽')
    .replace(/병신/g, '이상한')
    .replace(/똥꼬쇼/g, '무리수')
    .replace(/ㅅㅂ|시발|씨발/g, '아')
    .replace(/년놈|년들/g, '사람들');
}

function extractDcBody(html) {
  const $ = cheerio.load(html);
  const content = $('.write_div').first();
  if (!content.length) return '';

  content.find('script, style, iframe, ins, .appending_file_box, .btn_recom_up, .dccon_area').remove();
  content.find('br').replaceWith('\n');
  content.find('p, div').each((_, element) => {
    $(element).append('\n');
  });
  return cleanupText(content.text());
}

function extractGenericBody(html) {
  const $ = cheerio.load(html);
  const selectors = [
    '#bo_v_con',
    '.rd_body',
    '.article_view',
    '.view_content',
    '.write_div',
    'article',
  ];
  for (const selector of selectors) {
    const content = $(selector).first();
    if (!content.length) continue;
    content.find('script, style, iframe, ins, nav, aside').remove();
    content.find('br').replaceWith('\n');
    const text = cleanupText(content.text());
    if (text.length >= 20) return text;
  }
  return '';
}

async function fetchBody(post) {
  const url = sourceUrl(post.source_url);
  if (!url) return '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const response = await fetch(url, {
    headers: {
      'user-agent': ua,
      referer: new URL(url).origin,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const html = await response.text();
  const text = /dcinside\.com/i.test(url) ? extractDcBody(html) : extractGenericBody(html);
  return limitText(text);
}

function makeBody(post, sourceText) {
  const title = normalizeTitle(post.title);
  let text = cleanupText(sourceText);
  const titleVariants = [
    title,
    title.replace(/\.(jpg|jpeg|png|gif|webp)$/i, ''),
    title.replace(/[.…]+$/g, ''),
  ].filter(Boolean);
  for (const variant of titleVariants) {
    if (text.startsWith(variant)) {
      text = text.slice(variant.length).trim();
      break;
    }
  }
  if (!text) return sanitizeBody(title);
  return sanitizeBody(`${title}\n\n${text}`);
}

const postsJson = runWrangler([
  'd1',
  'execute',
  'jammoa-db',
  '--remote',
  '--json',
  '--command',
  `SELECT id,title,source_url FROM posts WHERE status='published' ORDER BY published_at DESC LIMIT ${postLimit};`,
]);

const posts = JSON.parse(postsJson)[0]?.results || [];
if (!posts.length) throw new Error('No published posts found');

const updates = [];
let crawled = 0;
let titleOnly = 0;
let failed = 0;

for (const post of posts) {
  try {
    const sourceText = await fetchBody(post);
    const body = makeBody(post, sourceText);
    if (!sourceText) titleOnly += 1;
    updates.push(`UPDATE posts SET body=${sqlValue(body)} WHERE id=${sqlValue(post.id)};`);
    crawled += 1;
    console.log(`ok\t${post.id}\t${sourceText.length}\t${post.title}`);
  } catch (error) {
    failed += 1;
    const body = normalizeTitle(post.title);
    updates.push(`UPDATE posts SET body=${sqlValue(body)} WHERE id=${sqlValue(post.id)};`);
    console.log(`fail\t${post.id}\t${error.message}`);
  }
}

const sqlFile = path.join(tmp, 'update-source-bodies-only.sql');
fs.writeFileSync(sqlFile, updates.join('\n'), 'utf8');
runWrangler(['d1', 'execute', 'jammoa-db', '--remote', '--file', sqlFile]);

console.log(`updated=${updates.length}`);
console.log(`crawled=${crawled}`);
console.log(`titleOnly=${titleOnly}`);
console.log(`failed=${failed}`);
console.log(`tmp=${tmp}`);

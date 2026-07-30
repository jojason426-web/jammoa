import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

const wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jammoa-enhanced-images-'));
const version = 'sharp-20260722a';
const siteBase = 'https://jammoa.com';
const ua =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

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

async function fetchImage(row) {
  const candidates = [
    row.source_image_url,
    row.image_url ? new URL(row.image_url, siteBase).toString() : '',
  ].filter(Boolean);

  let lastError;
  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': ua,
          referer: row.source_url || siteBase,
          accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
        redirect: 'follow',
      });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height) throw new Error(`invalid image ${url}`);
      return { buffer, sourceUrl: url, width: metadata.width, height: metadata.height };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`No image candidate for ${row.id}`);
}

async function enhanceImage(buffer) {
  return await sharp(buffer, { animated: false })
    .rotate()
    .resize({
      width: 960,
      height: 720,
      fit: 'inside',
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3,
    })
    .sharpen({ sigma: 0.75, m1: 1.15, m2: 2.1, x1: 2, y2: 10, y3: 20 })
    .modulate({ brightness: 1.015, saturation: 1.04 })
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
  "SELECT id, image_key, image_url, source_image_url, source_url FROM posts WHERE status='published' AND image_key IS NOT NULL ORDER BY published_at DESC;",
]);

const posts = JSON.parse(postsJson)[0]?.results || [];
if (!posts.length) throw new Error('No posts with images found');

const updates = [];
let enhanced = 0;
let failed = 0;

for (const post of posts) {
  try {
    const key = post.image_key || post.image_url?.replace(/^\/images\//, '').replace(/\?.*$/, '');
    if (!key) throw new Error(`missing image key for ${post.id}`);

    const source = await fetchImage(post);
    const image = await enhanceImage(source.buffer);
    const output = path.join(tmp, `${post.id}.webp`);
    fs.writeFileSync(output, image);

    runWrangler([
      'r2',
      'object',
      'put',
      `jammoa-images/${key}`,
      '--file',
      output,
      '--content-type',
      'image/webp',
      '--remote',
    ]);

    updates.push(
      `UPDATE posts SET image_url=${sqlValue(`/images/${key}?v=${version}`)}, image_format='webp' WHERE id=${sqlValue(post.id)};`,
    );
    enhanced += 1;
    console.log(`ok\t${post.id}\t${source.width}x${source.height}\t${key}`);
  } catch (error) {
    failed += 1;
    console.log(`fail\t${post.id}\t${error.message}`);
  }
}

if (updates.length) {
  const sqlFile = path.join(tmp, 'update-image-versions.sql');
  fs.writeFileSync(sqlFile, updates.join('\n'), 'utf8');
  runWrangler(['d1', 'execute', 'jammoa-db', '--remote', '--file', sqlFile]);
}

console.log(`enhanced=${enhanced}`);
console.log(`failed=${failed}`);
console.log(`version=${version}`);
console.log(`tmp=${tmp}`);

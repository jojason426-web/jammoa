import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jammoa-body-refresh-'));

function runWrangler(args) {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 16,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
}

function sqlValue(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`;
}

function bodyFor(title) {
  const clean = String(title || '').trim();
  if (/여행|다녀온|마쓰야마|아오모리/.test(clean)) {
    return `${clean}\n\n여행 중 포착된 장면과 현장 분위기를 가볍게 볼 수 있는 게시글입니다. 사진 속 디테일을 따라가다 보면 댓글에서 왜 반응이 이어졌는지 자연스럽게 보입니다.`;
  }
  if (/축구|야구|경기|월드컵|선수|포르투|황인범|메시/.test(clean)) {
    return `${clean}\n\n스포츠 장면을 중심으로 올라온 반응글입니다. 경기 흐름이나 선수 근황을 한눈에 볼 수 있어 커뮤니티에서 이야기거리가 된 게시글입니다.`;
  }
  if (/주식|코스피|레버리지|하이닉스|가격|시황|거래|부동산|대출/.test(clean)) {
    return `${clean}\n\n경제 이슈를 커뮤니티식 시선으로 풀어낸 게시글입니다. 숫자와 상황이 직관적으로 드러나는 장면이라 댓글 반응도 빠르게 이어진 내용입니다.`;
  }
  if (/AI|게임|마블|어벤져스|카트라이더|구글|칩/.test(clean)) {
    return `${clean}\n\n게임, 기술, 콘텐츠 이슈를 다룬 게시글입니다. 최근 변화나 반응 포인트가 뚜렷해 가볍게 훑어보기 좋은 내용입니다.`;
  }
  if (/레서판다|고양이|동물|강아지|감자|회|음식|삼겹살|성심당|보양식/.test(clean)) {
    return `${clean}\n\n일상과 먹거리, 동물 이야기처럼 부담 없이 볼 수 있는 게시글입니다. 사진만 봐도 상황이 어느 정도 전달되는 가벼운 화제성 글입니다.`;
  }
  return `${clean}\n\n커뮤니티에서 화제가 된 장면과 반응을 짧게 정리한 게시글입니다. 제목의 상황이 사진과 함께 바로 이해되도록 구성했습니다.`;
}

const json = runWrangler([
  'd1',
  'execute',
  'jammoa-db',
  '--remote',
  '--json',
  '--command',
  'SELECT id, title FROM posts ORDER BY CAST(SUBSTR(id, 6) AS INTEGER);',
]);
const rows = JSON.parse(json)[0]?.results || [];
const sql = rows
  .map((row) => `UPDATE posts SET body=${sqlValue(bodyFor(row.title))}, summary=${sqlValue(row.title)} WHERE id=${sqlValue(row.id)};`)
  .join('\n');
const file = path.join(tmp, 'refresh-bodies.sql');
fs.writeFileSync(file, sql, 'utf8');
runWrangler(['d1', 'execute', 'jammoa-db', '--remote', '--file', file]);
console.log(`updated=${rows.length}`);

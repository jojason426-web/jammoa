import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jammoa-bodies-only-'));

function runWrangler(args) {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 24,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
}

function sqlValue(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`;
}

function normalizeTitle(title) {
  return String(title || '')
    .replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstSentence(title) {
  const clean = normalizeTitle(title);
  if (/여행|마쓰야마|아오모리|연휴/.test(clean)) {
    return `${clean}\n\n사진으로 보니 생각보다 분위기가 좋았습니다. 특별한 장면이 아니어도 이동 중에 보이는 거리, 날씨, 표정이 남아서 가볍게 넘겨보기 좋네요.`;
  }
  if (/축구|야구|UFC|카트라이더|바둑|신진서|황인범|포르투|스페인/.test(clean)) {
    return `${clean}\n\n사진 한 장만 봐도 왜 말이 나왔는지 알 것 같습니다. 경기 흐름이나 선수 표정이 묘하게 잡혀서 결과보다 장면 자체가 더 오래 남네요.`;
  }
  if (/AI|ai|구글|칩|오픈소스|게이밍 엔진|개인정보|해킹|보조배터리|급발진/.test(clean)) {
    return `${clean}\n\n처음엔 그냥 기술 뉴스처럼 보였는데, 자세히 보면 생활하고 꽤 가까운 이야기였습니다. 숫자나 문구가 직접적으로 보여서 괜히 더 현실감이 있습니다.`;
  }
  if (/하이닉스|Jp모건|레버리지|ETF|시황|수출|부동산|근저당|대출|삼겹살|환불|기탁금/.test(clean)) {
    return `${clean}\n\n돈이 걸린 이야기는 숫자 하나만 보여도 바로 체감됩니다. 조건을 읽다 보면 이게 진짜 가능한 일인지, 아니면 뭔가 이상한 건지 먼저 따져보게 되네요.`;
  }
  if (/화재|법원|기소|체포|특검|선관위|협박|구속|살충제|폭행|사망|청구서|영장|경찰|피해|군사보호구역/.test(clean)) {
    return `${clean}\n\n제목부터 꽤 강하게 들어오는 내용입니다. 캡처에 핵심 문구가 바로 보여서, 누가 책임져야 하는지나 판단이 맞는지를 두고 말이 나올 수밖에 없어 보입니다.`;
  }
  if (/만화|소년만화|마블|어벤져스|둠스데이|영화|평점|서태지|음원|유튜브|JYP|bts|박나래|쯔양/.test(clean)) {
    return `${clean}\n\n아는 사람은 보자마자 바로 반응할 장면입니다. 별 설명 없이도 팬들이 싫어하거나 좋아하는 포인트가 보여서 댓글이 갈릴 만하네요.`;
  }
  if (/자연산|보양식|음식|삼겹살|홈플러스|성심당|서코 음식/.test(clean)) {
    return `${clean}\n\n사진을 보자마자 가격이나 상태부터 보게 됩니다. 먹거리 이야기는 다들 자기 경험이 있어서 그런지 작은 차이에도 반응이 바로 나오는 것 같습니다.`;
  }
  if (/레서판다|동물|감자/.test(clean)) {
    return `${clean}\n\n사진만 봐도 충분히 눈길이 갑니다. 귀엽거나 특이한 소재는 길게 설명하지 않아도 이상하게 한 번 더 보게 되네요.`;
  }
  if (/트위터|스레|커뮤니티|에브리타임|여시|스레드|DC|디시|싱글벙글|와들와들|오싹오싹/.test(clean)) {
    return `${clean}\n\n캡처 특유의 빠른 전개가 있습니다. 첫 줄만 봐도 대충 분위기가 잡히고, 뒤로 갈수록 왜 사람들이 댓글을 달았는지 보입니다.`;
  }
  if (/아파트|주차장|따릉이|청계천|논두렁|휴전선|전술도로|비행기|펜션/.test(clean)) {
    return `${clean}\n\n익숙한 장소에서 벌어진 일이라 더 눈에 들어옵니다. 사진 속 배경을 보면 상황이 바로 연결돼서 괜히 더 현실감 있게 느껴집니다.`;
  }
  return `${clean}\n\n사진하고 제목을 같이 보니 포인트가 바로 잡힙니다. 캡처에 담긴 문구나 표정이 먼저 들어오고, 그 다음에 왜 말이 나왔는지 보이네요.`;
}

function visualSentence(title) {
  const clean = normalizeTitle(title);
  if (/기사|단독|속보|법원|대통령|국회|특검|수출|판결|청장|위원장|국무회의|로이터/.test(clean)) {
    return '기사 화면은 제목이 커서 핵심이 먼저 보입니다. 금액이나 날짜 같은 정보가 같이 들어오면 그냥 넘기기보다 한 번 더 확인하게 됩니다.';
  }
  if (/트위터|스레|댓글|캡처|근황|논쟁|반응/.test(clean)) {
    return '댓글이나 SNS 캡처는 문장 하나가 포인트가 되는 경우가 많습니다. 길지 않은데도 말투나 줄바꿈 때문에 묘하게 웃긴 부분이 생깁니다.';
  }
  if (/여행|마쓰야마|아오모리|연휴|논두렁|노을/.test(clean)) {
    return '풍경 사진은 설명보다 분위기가 먼저입니다. 장소 이름을 몰라도 빛이나 거리감만으로 어느 정도 그날 느낌이 전해집니다.';
  }
  if (/만화|소년만화|SCP|어벤져스|마블/.test(clean)) {
    return '작품 관련 이미지는 아는 사람에게 특히 빨리 꽂힙니다. 모르는 사람이 봐도 대략 어떤 톤의 농담인지 정도는 바로 느껴집니다.';
  }
  if (/야구|축구|UFC|경기|PK|바둑|카트라이더|게이밍/.test(clean)) {
    return '스포츠나 게임 장면은 숫자와 표정이 같이 보일 때 재미가 큽니다. 결과보다 그 순간의 분위기가 더 크게 느껴질 때가 있습니다.';
  }
  if (/음식|회|보양식|삼겹살|홈플러스|성심당/.test(clean)) {
    return '음식 사진은 맛보다 먼저 가격, 양, 상태를 보게 됩니다. 그래서 사소한 문구 하나에도 각자 경험담이 붙기 쉽습니다.';
  }
  if (/AI|ai|구글|칩|개인정보|해킹|보조배터리|급발진|오픈소스/.test(clean)) {
    return '기술 이슈처럼 보여도 실제로는 돈, 안전, 개인정보 문제로 이어지는 경우가 많습니다. 캡처 속 문구가 구체적일수록 체감이 더 큽니다.';
  }
  return '화면 구도나 문구가 먼저 들어와서 상황을 바로 떠올리게 합니다. 작게 봐도 대략적인 분위기가 살아 있는 편입니다.';
}

function reactionSentence(title, boardId) {
  const clean = normalizeTitle(title);
  if (/ㄷㄷ|ㅋㅋ|싱글벙글|오싹오싹|와들와들/.test(clean)) {
    return '처음에는 가볍게 웃고 넘길 수 있는데, 자세히 보면 묘하게 현실적인 부분이 있어서 반응이 더 커졌습니다. 그래서 댓글도 농담과 진지한 해석이 같이 섞이는 흐름입니다.';
  }
  if (/논란|갈등|비판|규제|해체|의혹|불법|편법|허위/.test(clean)) {
    return '반응은 단순한 호불호보다 “이게 맞나” 쪽으로 모입니다. 캡처 한 장에서 시작했지만 제도, 규정, 책임 문제까지 이어져 이야깃거리가 꽤 많은 글입니다.';
  }
  if (/귀여|레서판다|아기|감자|자연산|여행/.test(clean)) {
    return '무겁게 따질 내용보다는 사진을 보며 가볍게 반응하기 좋은 쪽입니다. 소소한 디테일을 발견하는 재미가 있어서 편하게 넘겨보기 좋습니다.';
  }
  if (/돈|원|만원|조|수출|대출|ETF|레버리지|시황|가격|배상|기탁금|환불/.test(clean)) {
    return '숫자가 들어간 주제라 체감이 빠릅니다. 댓글에서는 금액이 큰지 작은지, 실제로 가능한 일인지 같은 현실적인 반응이 먼저 나옵니다.';
  }
  if (boardId === 'legend') {
    return '짧은 장면이지만 기억에 남는 포인트가 있어 레전드 쪽에 어울리는 글입니다. 한 번 보고 지나가기보다 다시 보게 되는 디테일이 있습니다.';
  }
  return '처음엔 한 장면처럼 보이지만, 다시 보면 작은 디테일이 꽤 많습니다. 그래서 제목만 봤을 때보다 사진을 같이 볼 때 훨씬 자연스럽게 이해됩니다.';
}

function makeBody(post) {
  return `${firstSentence(post.title)}\n\n${visualSentence(post.title)}\n\n${reactionSentence(post.title, post.board_id)}`;
}

const postsJson = runWrangler([
  'd1',
  'execute',
  'jammoa-db',
  '--remote',
  '--json',
  '--command',
  "SELECT id,title,board_id FROM posts WHERE status='published' ORDER BY published_at DESC;",
]);

const posts = JSON.parse(postsJson)[0]?.results || [];
if (!posts.length) throw new Error('No published posts found');

const updates = posts.map((post) => `UPDATE posts SET body=${sqlValue(makeBody(post))} WHERE id=${sqlValue(post.id)};`);
const sqlFile = path.join(tmp, 'update-bodies-only.sql');
fs.writeFileSync(sqlFile, updates.join('\n'), 'utf8');
runWrangler(['d1', 'execute', 'jammoa-db', '--remote', '--file', sqlFile]);

console.log(`updated=${updates.length}`);
console.log(`tmp=${tmp}`);

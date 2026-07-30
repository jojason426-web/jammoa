export type BoardId = 'all' | 'humor' | 'meme' | 'video' | 'issue' | 'legend'

export type Board = {
  id: Exclude<BoardId, 'all'>
  name: string
  description: string
}

export type Post = {
  id: string
  board_id: Exclude<BoardId, 'all'>
  title: string
  summary: string
  source_name: string
  source_url: string
  image_url: string
  body: string[]
  comments: string[]
  up_count: number
  comment_count: number
  view_count: number
  published_at: string
}

export const boards: Board[] = [
  { id: 'humor', name: '유머', description: '짧고 빠른 웃긴 글' },
  { id: 'meme', name: '짤방', description: '이미지와 밈 모음' },
  { id: 'video', name: '움짤', description: '짧은 영상과 움직이는 이미지' },
  { id: 'issue', name: '이슈', description: '오늘 반응 좋은 화제' },
  { id: 'legend', name: '레전드', description: '저장해둘 만한 인기글' },
]

const titleSeeds = [
  '월요일 아침 회의에서 살아남는 법',
  '편의점 알바가 본 가장 평화로운 손님',
  '단톡방에서 모두가 조용해진 순간',
  '택배 기사님 메모에 빵 터진 사연',
  '회사 냉장고 앞에서 벌어진 심리전',
  '평범한 사진인 줄 알았는데 반전',
  '지하철에서 본 완벽한 팀워크',
  '엄마의 짧은 답장이 제일 무섭다',
  '친구가 만든 기적의 절약법',
  '운동 첫날에 깨달은 현실',
  '배달 요청사항 레전드 모음',
  '카페 알바가 인정한 주문 센스',
  '컴퓨터 잘 아는 척하다 걸린 날',
  '비 오는 날 우산 하나로 생긴 일',
  '산책 중 만난 예상 밖의 상황',
  '동네 나눔에서 발견한 묘한 친절',
  '시험 전날 갑자기 철학자가 된 친구',
  '주차장에서 모두가 박수친 이유',
  '식당 사장님의 단호한 공지',
  '아침형 인간 도전 3일차 기록',
]

const summaries = [
  '짧지만 댓글이 길어질 만한 상황극입니다.',
  '일상에서 바로 상상되는 소소한 웃음 포인트입니다.',
  '제목만 보고 들어왔다가 저장하게 되는 타입입니다.',
  '가볍게 읽기 좋은 오늘의 웃긴 장면입니다.',
  '한 번쯤 겪어봤을 법한 현실 웃음 포인트입니다.',
]

const authorNames = ['잼모아', '하하잼']
const bodyTemplates = [
  {
    scene: '회의실',
    icon: '☕',
    lines: [
      '월요일 오전 9시, 회의실 공기가 유난히 무거웠습니다. 다들 노트북은 열어뒀지만 눈빛은 아직 주말에 남아 있는 표정이었습니다.',
      '팀장이 “간단히 공유만 하고 끝내죠”라고 말하는 순간, 모두가 동시에 자세를 고쳐 앉았습니다. 그런데 그 말 뒤에 붙은 파일 이름이 ‘최종_진짜최종_수정본2’였습니다.',
      '누군가 작게 “그럼 간단하지 않겠네요”라고 말했고, 회의실 전체가 2초 동안 조용해졌습니다. 그 짧은 침묵이 오히려 제일 웃겼습니다.',
      '결국 회의는 길어졌지만 모두가 같은 마음이었다는 걸 확인한 덕분에 분위기는 이상하게 좋아졌습니다.',
    ],
  },
  {
    scene: '편의점',
    icon: '🧾',
    lines: [
      '새벽 편의점에 들어온 손님은 컵라면 하나와 우유 하나를 들고 계산대로 왔습니다. 그런데 계산보다 먼저 “오늘도 고생 많으십니다”라고 아주 차분하게 말했습니다.',
      '직원이 살짝 당황해서 웃자 손님은 봉투도 필요 없고 영수증도 괜찮다며 동선까지 완벽하게 정리했습니다.',
      '뒤에 있던 사람들도 묘하게 숙연해졌고, 그 순간 계산대 앞은 작은 시상식처럼 조용해졌습니다.',
      '별일 아닌 친절인데도 타이밍과 태도가 너무 완벽해서 오래 기억에 남는 장면이 됐습니다.',
    ],
  },
  {
    scene: '단톡방',
    icon: '💬',
    lines: [
      '단톡방은 평소처럼 시끄러웠습니다. 누군가는 점심 메뉴를 묻고, 누군가는 아무 상관없는 사진을 올리고 있었습니다.',
      '그때 한 명이 “이거 누구냐”라는 말과 함께 캡처 한 장을 올렸습니다. 읽음 숫자는 순식간에 사라졌지만 답장은 아무도 하지 않았습니다.',
      '가장 말 많던 친구마저 조용해지자 다들 뭔가 큰일이 났다는 걸 직감했습니다.',
      '결국 범인은 3분 뒤에 나타나 “나 아닌 척하려고 했는데 너무 티났네”라고 했고, 그때부터 채팅방은 다시 폭발했습니다.',
    ],
  },
  {
    scene: '택배',
    icon: '📦',
    lines: [
      '택배 요청사항에는 단 한 줄만 적혀 있었습니다. “초인종 누르지 말고 문 앞에 조용히 두고 가주세요. 안에는 사람이지만 마음은 없습니다.”',
      '기사님은 요청을 그대로 지켜줬고, 배송 완료 사진에는 문 앞에 아주 단정하게 놓인 박스가 찍혀 있었습니다.',
      '문제는 가족 단톡방에 그 문구가 공유되면서 시작됐습니다. 다들 누구 요청사항이냐고 물었지만 아무도 인정하지 않았습니다.',
      '짧은 문장 하나였는데 집 안 전체가 조용히 웃긴 상황이 되어버렸습니다.',
    ],
  },
  {
    scene: '회사 냉장고',
    icon: '🥤',
    lines: [
      '회사 냉장고 앞에 사람들이 하나둘 모이기 시작했습니다. 누군가의 음료가 사라졌다는 말이 돌았지만 아무도 먼저 말하지 않았습니다.',
      '문제의 음료와 같은 브랜드를 들고 있던 사람은 갑자기 회의가 있다며 자리를 피했고, 그 순간 모두가 같은 방향을 바라봤습니다.',
      '범인을 몰아세운 사람은 없었지만 냉장고 앞 침묵은 어떤 회의보다 진지했습니다.',
      '결말은 사소했습니다. 음료 주인이 다른 칸에 넣어둔 걸 잊은 것이었습니다. 그래도 모두가 너무 진지했던 탓에 웃음이 터졌습니다.',
    ],
  },
]
const commentTemplates = [
  ['이건 제목만 봐도 장면이 그려집니다.', '저 상황이면 저도 웃음 참기 실패했을 듯.', '생활감 있어서 더 웃기네요.'],
  ['짧은데 묘하게 계속 생각납니다.', '이런 게 진짜 현실 유머죠.', '댓글까지 보면 더 완성될 글입니다.'],
  ['타이밍이 전부인 글이네요.', '저런 순간 실제로 보면 하루 종일 웃김.', '캡처해서 단톡방에 보내고 싶은 느낌.'],
]

const paletteByBoard: Record<Exclude<BoardId, 'all'>, { bg: string; fg: string; sub: string }> = {
  humor: { bg: '#fff3d8', fg: '#b64822', sub: '#ffe0a3' },
  meme: { bg: '#eaf4ff', fg: '#3156a3', sub: '#cde4ff' },
  video: { bg: '#eef8ee', fg: '#2f7545', sub: '#ccebd2' },
  issue: { bg: '#fff0f0', fg: '#b5343c', sub: '#ffd5d8' },
  legend: { bg: '#f1edff', fg: '#5a46a8', sub: '#dcd3ff' },
}

function makePostImage(title: string, board: Board, index: number) {
  const palette = paletteByBoard[board.id]
  const shortTitle = title.replace(/\s#\d+$/, '').slice(0, 18)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
      <rect width="960" height="540" fill="${palette.bg}"/>
      <circle cx="780" cy="96" r="110" fill="${palette.sub}" opacity="0.75"/>
      <circle cx="112" cy="444" r="150" fill="${palette.sub}" opacity="0.55"/>
      <rect x="72" y="70" width="816" height="400" rx="26" fill="#ffffff" opacity="0.86"/>
      <text x="104" y="140" font-family="Apple SD Gothic Neo, Malgun Gothic, sans-serif" font-size="34" font-weight="700" fill="${palette.fg}">${board.name}</text>
      <text x="104" y="250" font-family="Apple SD Gothic Neo, Malgun Gothic, sans-serif" font-size="58" font-weight="800" fill="#222222">${escapeXml(shortTitle)}</text>
      <text x="104" y="330" font-family="Apple SD Gothic Neo, Malgun Gothic, sans-serif" font-size="30" fill="#555555">잼모아 오늘의 웃긴 장면</text>
      <text x="744" y="350" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif" font-size="120">${bodyTemplates[index % bodyTemplates.length].icon}</text>
      <rect x="104" y="390" width="210" height="44" rx="22" fill="${palette.fg}" opacity="0.92"/>
      <text x="133" y="421" font-family="Apple SD Gothic Neo, Malgun Gothic, sans-serif" font-size="22" font-weight="700" fill="#ffffff">${bodyTemplates[index % bodyTemplates.length].scene}</text>
    </svg>`

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function escapeXml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export const mockPosts: Post[] = Array.from({ length: 100 }, (_, index) => {
  const n = index + 1
  const board = boards[index % boards.length]
  const published = new Date(Date.UTC(2026, 6, 19, 0, 0, 0) - index * 36 * 60 * 1000)

  return {
    id: `post-${String(n).padStart(3, '0')}`,
    board_id: board.id,
    title: `${titleSeeds[index % titleSeeds.length]} #${String(n).padStart(3, '0')}`,
    summary: summaries[index % summaries.length],
    source_name: authorNames[index % authorNames.length],
    source_url: `https://jammoa.com/source/seed/${n}`,
    image_url: makePostImage(titleSeeds[index % titleSeeds.length], board, index),
    body: bodyTemplates[index % bodyTemplates.length].lines,
    comments: commentTemplates[index % commentTemplates.length],
    up_count: 20 + ((n * 17) % 480),
    comment_count: (n * 7) % 96,
    view_count: 300 + ((n * 113) % 12000),
    published_at: published.toISOString(),
  }
})

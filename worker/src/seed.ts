export type SeedPost = {
  id: string
  boardId: string
  title: string
  summary: string
  body: string
  sourceName: string
  sourceUrl: string
  sourceImageUrl: string
  imageKey: string
  imageUrl: string
  contentHash: string
  createdAt: string
  publishedAt: string
  upCount: number
  commentCount: number
  viewCount: number
}

export const boards = [
  { id: 'humor', name: '유머', description: '짧고 빠른 웃긴 글', sortOrder: 1 },
  { id: 'meme', name: '짤방', description: '이미지와 밈 모음', sortOrder: 2 },
  { id: 'video', name: '움짤', description: '짧은 영상과 움직이는 이미지', sortOrder: 3 },
  { id: 'issue', name: '이슈', description: '오늘 반응 좋은 화제', sortOrder: 4 },
  { id: 'legend', name: '레전드', description: '저장해둘 만한 인기글', sortOrder: 5 },
] as const

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

export function createSeedPosts(): SeedPost[] {
  return Array.from({ length: 100 }, (_, index) => {
    const n = index + 1
    const board = boards[index % boards.length]
    const created = new Date(Date.UTC(2026, 6, 19, 0, 0, 0) - index * 36 * 60 * 1000)
    const title = `${titleSeeds[index % titleSeeds.length]} #${String(n).padStart(3, '0')}`

    return {
      id: `post-${String(n).padStart(3, '0')}`,
      boardId: board.id,
      title,
      summary: summaries[index % summaries.length],
      body: '아침부터 분위기가 묘하게 조용하더니, 누군가 한마디를 꺼내는 순간 다들 동시에 고개를 끄덕였습니다. 별일 아닌 상황인데도 타이밍이 너무 절묘해서 웃음을 참는 사람이 하나둘 늘어났습니다.',
      sourceName: authorNames[index % authorNames.length],
      sourceUrl: `https://jammoa.com/source/seed/${n}`,
      sourceImageUrl: `https://picsum.photos/seed/jammoa-${n}/960/540`,
      imageKey: `posts/seed/post-${String(n).padStart(3, '0')}.webp`,
      imageUrl: `/images/posts/seed/post-${String(n).padStart(3, '0')}.webp`,
      contentHash: `seed-${n}-${board.id}`,
      createdAt: created.toISOString(),
      publishedAt: created.toISOString(),
      upCount: 20 + ((n * 17) % 480),
      commentCount: (n * 7) % 96,
      viewCount: 300 + ((n * 113) % 12000),
    }
  })
}

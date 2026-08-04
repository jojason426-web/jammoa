import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import './App.css'
import { AdSenseUnit } from './components/AdSenseUnit'
import { type BoardId, boards, type Post } from './data/mockPosts'

type SortMode = 'latest' | 'best'
type SearchScope = 'title' | 'source' | 'content'
type ViewMode = 'text' | 'image'

const postsPerPage = 30

type ApiPost = Omit<Post, 'body' | 'comments'> & {
  body?: string | string[]
  comments?: string[] | ApiComment[]
}

type ApiComment = {
  body?: string
  content?: string
  text?: string
}

function normalizeApiPost(post: ApiPost): Post {
  const comments = (post.comments ?? [])
    .map((comment) => (typeof comment === 'string' ? comment : comment.body || comment.content || comment.text || ''))
    .filter(Boolean)

  return {
    ...post,
    body: Array.isArray(post.body)
      ? post.body
      : post.body
        ? post.body.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean)
        : [],
    comments,
  } as Post
}

const notices = [
  {
    id: 'notice-rules',
    title: '유머 게시판 공지 및 규정',
    body: [
      '잼모아는 누구나 편하게 읽을 수 있는 유머 게시판을 지향합니다.',
      '성인물, 혐오 표현, 불법 행위 조장, 개인정보 노출, 저작권 침해 게시물은 제한됩니다.',
      '반복적인 광고, 도배, 분쟁 유도성 글은 운영 정책에 따라 비공개 또는 삭제될 수 있습니다.',
    ],
  },
  {
    id: 'notice-moderation',
    title: '차단, 글 이동, 삭제, 관리 불만글 금지',
    body: [
      '게시글은 카테고리 성격에 맞게 이동될 수 있으며, 정책 위반이 확인되면 삭제될 수 있습니다.',
      '운영 관련 문의는 게시판 글이 아니라 문의 페이지를 통해 접수해주세요.',
      '명확한 사유가 있는 신고는 검토 후 빠르게 조치합니다.',
    ],
  },
  {
    id: 'notice-safety',
    title: '시위, 신고, 화력, 청원, 민원 요청 및 인증 금지',
    body: [
      '외부 사이트나 특정 개인을 대상으로 한 집단 행동 요청은 허용하지 않습니다.',
      '신고, 민원, 청원, 화력 지원 요청 및 인증 글은 게시판 안정성을 위해 제한합니다.',
      '게시글은 웃음과 정보 공유 목적에 맞게 작성해주세요.',
    ],
  },
]

type MainNavMode = BoardId | 'best' | 'notice'

const galleryLinks: { label: string; mode: MainNavMode }[] = [
  { label: '전체글', mode: 'all' },
  { label: '실시간베스트', mode: 'best' },
  { label: '유머', mode: 'humor' },
  { label: '짤방', mode: 'meme' },
  { label: '움짤', mode: 'video' },
  { label: '이슈', mode: 'issue' },
  { label: '레전드', mode: 'legend' },
  { label: '공지', mode: 'notice' },
]
const sideNotices = ['저작권 신고는 문의 페이지에서 접수합니다.', '성인/혐오/불법 콘텐츠는 노출하지 않습니다.', '수집 글은 검수 후 게시됩니다.']
const todayKeywords = ['월요일', '회사생활', '반전사진', '웃긴짤', '단톡방', '레전드']
const adSlots = {
  bottomRight: (import.meta.env.VITE_ADSENSE_SLOT_BOTTOM_RIGHT ||
    import.meta.env.VITE_ADSENSE_SLOT_SIDE) as string | undefined,
}
const businessInfo = {
  siteName: '잼모아',
  siteUrl: 'https://jammoa.com',
  operator: '조근형',
  email: 'jojason426@gmail.com',
}
const infoPages = [
  {
    path: '/about',
    title: '서비스 소개',
    paragraphs: [
      '잼모아는 국내 온라인에서 반응 좋은 유머, 짤방, 이슈성 글을 보기 쉽게 정리하는 게시판형 콘텐츠 사이트입니다.',
      `사이트명: ${businessInfo.siteName}`,
      `공식 URL: ${businessInfo.siteUrl}`,
      `운영자: ${businessInfo.operator}`,
      '이 사이트는 독자가 빠르게 글을 찾고 읽을 수 있도록 게시판, 검색, 인기글, 상세 페이지를 제공합니다.',
      '성인물, 혐오, 불법 행위 조장, 저작권 침해 콘텐츠는 운영 정책에 따라 제한합니다.',
    ],
  },
  {
    path: '/business',
    title: '운영자 정보',
    paragraphs: [
      `사이트명: ${businessInfo.siteName}`,
      `비즈채널 URL: ${businessInfo.siteUrl}`,
      `운영자: ${businessInfo.operator}`,
      `문의 이메일: ${businessInfo.email}`,
      '잼모아는 게시판형 유머 콘텐츠를 정리해 제공하는 온라인 콘텐츠 서비스입니다.',
      '서비스 운영, 광고, 제휴, 권리 침해 신고와 관련된 문의는 위 이메일로 접수합니다.',
    ],
  },
  {
    path: '/contact',
    title: '문의',
    paragraphs: [
      `사이트명: ${businessInfo.siteName}`,
      `운영자: ${businessInfo.operator}`,
      '운영 문의, 저작권 신고, 광고 및 제휴 문의는 이메일로 접수합니다.',
      `이메일: ${businessInfo.email}`,
      '신고 접수 시 게시글 주소, 문제 사유, 권리 증빙 자료를 함께 보내주시면 더 빠르게 확인할 수 있습니다.',
    ],
  },
  {
    path: '/privacy',
    title: '개인정보처리방침',
    paragraphs: [
      '잼모아는 서비스 제공, 보안, 통계 분석, 문의 대응을 위해 필요한 최소한의 정보를 처리합니다.',
      'Google AdSense 등 제3자 광고 서비스가 쿠키 또는 유사 기술을 사용해 광고를 표시할 수 있습니다.',
      '방문자는 브라우저 설정을 통해 쿠키 저장을 거부하거나 삭제할 수 있습니다.',
      `개인정보 관련 문의는 ${businessInfo.email} 으로 보내주세요.`,
    ],
  },
  {
    path: '/terms',
    title: '이용약관',
    paragraphs: [
      '잼모아 이용자는 관련 법령과 사이트 운영 정책을 준수해야 합니다.',
      '무단 광고, 스팸, 악성코드, 개인정보 노출, 저작권 침해 게시물은 제한됩니다.',
      '운영자는 신고 접수 또는 정책 위반 확인 시 게시물을 수정, 이동, 비공개 또는 삭제할 수 있습니다.',
    ],
  },
  {
    path: '/content-policy',
    title: '콘텐츠 정책',
    paragraphs: [
      '잼모아는 안전한 광고 게재를 위해 콘텐츠 검수 기준을 운영합니다.',
      '성적으로 노골적인 콘텐츠, 폭력적이거나 혐오적인 콘텐츠, 불법 행위 조장 콘텐츠는 허용하지 않습니다.',
      '저작권자가 삭제를 요청하면 확인 후 신속히 조치합니다.',
    ],
  },
  {
    path: '/ads',
    title: '광고 안내',
    paragraphs: [
      '이 페이지는 애드센스 심사를 위한 광고 고지와 사이트 신뢰 정보를 제공합니다.',
      '광고는 메뉴, 다운로드 버튼, 본문 링크와 혼동되지 않는 위치에만 배치합니다.',
      '운영자는 광고 클릭을 유도하지 않으며 무효 트래픽을 방지하기 위해 비정상 활동을 모니터링합니다.',
    ],
  },
]

function App() {
  const [activeBoard, setActiveBoard] = useState<BoardId>('all')
  const [sort, setSort] = useState<SortMode>('latest')
  const [query, setQuery] = useState('')
  const [searchScope, setSearchScope] = useState<SearchScope>('title')
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState<ViewMode>('image')
  const [posts, setPosts] = useState<Post[]>([])
  const [detailPost, setDetailPost] = useState<Post | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [postsLoading, setPostsLoading] = useState(true)
  const [currentPath, setCurrentPath] = useState(window.location.pathname)

  useEffect(() => {
    fetch('/api/posts?limit=300')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('API unavailable'))))
      .then((data: { posts?: ApiPost[] }) => {
        setPosts((data.posts ?? []).map(normalizeApiPost))
      })
      .catch(() => setPosts([]))
      .finally(() => setPostsLoading(false))
  }, [])

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return [...posts]
      .filter((post) => activeBoard === 'all' || post.board_id === activeBoard)
      .filter((post) => {
        if (!normalizedQuery) return true
        const searchableText =
          searchScope === 'title'
            ? post.title
            : searchScope === 'source'
              ? post.source_name
              : `${post.title} ${post.summary} ${post.body.join(' ')} ${post.source_name}`
        return searchableText.toLowerCase().includes(normalizedQuery)
      })
      .sort((a, b) => {
        if (sort === 'best') {
          const scoreA = a.up_count * 3 + a.comment_count * 1.5 + a.view_count * 0.1
          const scoreB = b.up_count * 3 + b.comment_count * 1.5 + b.view_count * 0.1
          return scoreB - scoreA
        }

        return new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
      })
  }, [activeBoard, posts, query, searchScope, sort])

  useEffect(() => {
    setCurrentPage(1)
  }, [activeBoard, query, searchScope, sort])

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / postsPerPage))
  const safePage = Math.min(currentPage, totalPages)
  const pagePosts = filteredPosts.slice((safePage - 1) * postsPerPage, safePage * postsPerPage)

  const popularPosts = filteredPosts.slice(0, 5)
  const postMatch = currentPath.match(/^\/posts\/([^/]+)$/)
  const selectedPost = postMatch
    ? posts.find((post) => post.id === postMatch[1]) || (detailPost?.id === postMatch[1] ? detailPost : undefined)
    : undefined
  const noticeMatch = currentPath.match(/^\/notices\/([^/]+)$/)
  const selectedNotice = noticeMatch ? notices.find((notice) => notice.id === noticeMatch[1]) : undefined
  const selectedInfoPage = infoPages.find((page) => page.path === currentPath)

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path)
    setCurrentPath(path)
  }

  const handleMainNavClick = (mode: MainNavMode) => {
    if (mode === 'notice') {
      setSort('latest')
      setActiveBoard('all')
      setQuery('')
      navigateTo('/notices/notice-rules')
      return
    }

    if (mode === 'best') {
      setSort('best')
      setActiveBoard('all')
      setQuery('')
      navigateTo('/')
      return
    }

    setSort('latest')
    setActiveBoard(mode)
    setQuery('')
    navigateTo('/')
  }

  useEffect(() => {
    const match = currentPath.match(/^\/posts\/([^/]+)$/)
    if (!match) {
      setDetailPost(null)
      setDetailLoading(false)
      return
    }

    const id = decodeURIComponent(match[1])
    if (posts.some((post) => post.id === id) || detailPost?.id === id) {
      setDetailLoading(false)
      return
    }

    let cancelled = false
    setDetailLoading(true)
    fetch(`/api/posts/${encodeURIComponent(id)}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Post unavailable'))))
      .then((data: { post?: ApiPost; comments?: string[] }) => {
        if (cancelled || !data.post) return
        const nextPost = normalizeApiPost({
          ...data.post,
          comments: data.comments ?? data.post.comments,
        })
        setDetailPost(nextPost)
        setPosts((currentPosts) => (currentPosts.some((post) => post.id === nextPost.id) ? currentPosts : [nextPost, ...currentPosts]))
      })
      .catch(() => {
        if (!cancelled) setDetailPost(null)
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [currentPath, detailPost?.id, posts])

  const activeNav: MainNavMode =
    currentPath.startsWith('/notices/')
      ? 'notice'
      : sort === 'best'
        ? 'best'
        : activeBoard

  if (selectedInfoPage) {
    return (
      <ForumFrame activeNav={activeNav} query={query} setQuery={setQuery} navigateTo={navigateTo} onMainNavClick={handleMainNavClick}>
        <InfoPage title={selectedInfoPage.title} paragraphs={selectedInfoPage.paragraphs} />
      </ForumFrame>
    )
  }

  if (selectedNotice) {
    return (
      <ForumFrame activeNav="notice" query={query} setQuery={setQuery} navigateTo={navigateTo} onMainNavClick={handleMainNavClick}>
        <article className="post-detail">
          <div className="detail-titlebar">
            <button onClick={() => navigateTo('/')}>목록으로</button>
            <span>공지</span>
          </div>
          <header className="detail-header">
            <h1>{selectedNotice.title}</h1>
            <dl>
              <div>
                <dt>글쓴이</dt>
                <dd>운영자</dd>
              </div>
              <div>
                <dt>날짜</dt>
                <dd>17.11.09</dd>
              </div>
              <div>
                <dt>분류</dt>
                <dd>공지</dd>
              </div>
            </dl>
          </header>
          <div className="detail-body detail-body--notice">
            {selectedNotice.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </article>
      </ForumFrame>
    )
  }

  if (postMatch && (postsLoading || detailLoading)) {
    return (
      <ForumFrame activeNav={activeNav} query={query} setQuery={setQuery} navigateTo={navigateTo} onMainNavClick={handleMainNavClick}>
        <article className="post-detail"><p>게시글을 불러오는 중입니다.</p></article>
      </ForumFrame>
    )
  }

  if (selectedPost) {
    return (
      <ForumFrame activeNav={selectedPost.board_id} query={query} setQuery={setQuery} navigateTo={navigateTo} onMainNavClick={handleMainNavClick}>
        <article className="post-detail">
          <div className="detail-titlebar">
            <button onClick={() => navigateTo('/')}>목록으로</button>
            <span>{boards.find((board) => board.id === selectedPost.board_id)?.name}</span>
          </div>
          <header className="detail-header">
            <h1>{selectedPost.title}</h1>
            <dl>
              <div>
                <dt>글쓴이</dt>
                <dd>{selectedPost.source_name}</dd>
              </div>
              <div>
                <dt>조회</dt>
                <dd>{formatCompact(selectedPost.view_count)}</dd>
              </div>
              <div>
                <dt>추천</dt>
                <dd>{selectedPost.up_count}</dd>
              </div>
              <div>
                <dt>댓글</dt>
                <dd>{selectedPost.comment_count}</dd>
              </div>
            </dl>
          </header>
          <div className="detail-body">
            <img src={selectedPost.image_url} alt="" />
            {selectedPost.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <section className="comment-preview" aria-label="댓글 미리보기">
              <h2>댓글</h2>
              <ul>
                {selectedPost.comments.map((comment, index) => (
                  <li key={comment}>
                    {index % 2 === 0 ? '잼모아' : '하하잼'}: {comment}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </article>
      </ForumFrame>
    )
  }

  return (
    <ForumFrame activeNav={activeNav} query={query} setQuery={setQuery} navigateTo={navigateTo} onMainNavClick={handleMainNavClick}>
        <section className="board">
          <div className="board-titlebar">
            <h1>유머/움짤/이슈</h1>
            <div className="board-tools" aria-label="게시글 정렬">
              <button className={sort === 'latest' ? 'is-active' : ''} onClick={() => setSort('latest')}>
                최신글
              </button>
              <button className={sort === 'best' ? 'is-active' : ''} onClick={() => setSort('best')}>
                인기글
              </button>
            </div>
          </div>

          <div className="category-strip" aria-label="게시판 분류">
            <button
              className={activeBoard === 'all' && sort === 'latest' ? 'is-active' : ''}
              onClick={() => {
                setSort('latest')
                setActiveBoard('all')
                setQuery('')
              }}
            >
              전체
            </button>
            {boards.map((board) => (
              <button
                className={activeBoard === board.id ? 'is-active' : ''}
                key={board.id}
                onClick={() => {
                  setSort('latest')
                  setActiveBoard(board.id)
                  setQuery('')
                }}
              >
                {board.name}
              </button>
            ))}
            <span className="category-separator" aria-hidden="true"></span>
            <button
              className={viewMode === 'text' ? 'is-active' : ''}
              onClick={() => setViewMode('text')}
            >
              {'\uD14D\uC2A4\uD2B8 \uD615\uC2DD'}
            </button>
            <button
              className={viewMode === 'image' ? 'is-active' : ''}
              onClick={() => setViewMode('image')}
            >
              {'\uC774\uBBF8\uC9C0 \uD615\uC2DD'}
            </button>
          </div>

          <FeaturedPosts posts={filteredPosts.slice(0, 4)} navigateTo={navigateTo} />

          <table className="post-table">
            <caption>잼모아 유머 게시판 글 목록</caption>
            <colgroup>
              <col className="col-number" />
              {viewMode === 'image' && <col className="col-thumb" />}
              <col className="col-title" />
              <col className="col-author" />
              <col className="col-date" />
              <col className="col-views" />
              <col className="col-votes" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">번호</th>
                {viewMode === 'image' && <th scope="col">{'\uC774\uBBF8\uC9C0'}</th>}
                <th scope="col">제목</th>
                <th scope="col">글쓴이</th>
                <th scope="col">날짜</th>
                <th scope="col">조회</th>
                <th scope="col">추천</th>
              </tr>
            </thead>
            <tbody>
              {notices.map((notice, index) => (
                <tr className="notice-row" key={notice.id}>
                  <td>공지</td>
                  {viewMode === 'image' && <td aria-hidden="true" className="post-thumb-cell"></td>}
                  <td>
                    <a href={`/notices/${notice.id}`} onClick={(event) => {
                      event.preventDefault()
                      navigateTo(`/notices/${notice.id}`)
                    }}>
                      <span className="label label--notice">공지</span>
                      {notice.title}
                    </a>
                  </td>
                  <td>운영자</td>
                  <td>17.11.09</td>
                  <td>{index === 0 ? '3.6M' : '2.8M'}</td>
                  <td>-</td>
                </tr>
              ))}
              {pagePosts.map((post, index) => (
                <tr key={post.id}>
                  <td>{filteredPosts.length - ((safePage - 1) * postsPerPage + index)}</td>
                  {viewMode === 'image' && (
                    <td className="post-thumb-cell">
                      <PostThumbnail post={post} navigateTo={navigateTo} />
                    </td>
                  )}
                  <td>
                    <a href={`/posts/${post.id}`} onClick={(event) => {
                      event.preventDefault()
                      navigateTo(`/posts/${post.id}`)
                    }}>
                      <span className="board-badge">{boards.find((board) => board.id === post.board_id)?.name}</span>
                      {post.title}
                      <span className="comment-count">[{post.comment_count}]</span>
                    </a>
                  </td>
                  <td>{post.source_name}</td>
                  <td>{formatDate(post.published_at)}</td>
                  <td>{formatCompact(post.view_count)}</td>
                  <td>{post.up_count}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="board-actions">
            <button
              onClick={() => {
                setSort('latest')
                setActiveBoard('all')
                setQuery('')
                setSearchScope('title')
                setCurrentPage(1)
                navigateTo('/')
              }}
            >
              {'\uBAA9\uB85D'}
            </button>
            <button className="primary" onClick={() => navigateTo('/contact')}>{'\uAE00\uC4F0\uAE30'}</button>
          </div>

          <nav className="pagination" aria-label={'\uD398\uC774\uC9C0 \uC774\uB3D9'}>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1).map((page) => (
              <a
                className={page === safePage ? 'is-active' : ''}
                href={`/?page=${page}`}
                key={page}
                onClick={(event) => {
                  event.preventDefault()
                  setCurrentPage(page)
                  navigateTo(`/?page=${page}`)
                }}
              >
                {page}
              </a>
            ))}
            {safePage < totalPages && (
              <a
                href={`/?page=${safePage + 1}`}
                onClick={(event) => {
                  event.preventDefault()
                  setCurrentPage(safePage + 1)
                  navigateTo(`/?page=${safePage + 1}`)
                }}
              >
                {'\uB2E4\uC74C'}
              </a>
            )}
          </nav>

          <form className="board-search" onSubmit={(event) => {
            event.preventDefault()
            setCurrentPage(1)
            navigateTo('/')
          }}>
            <select
              aria-label={'\uAC80\uC0C9 \uBC94\uC704'}
              value={searchScope}
              onChange={(event) => setSearchScope(event.target.value as SearchScope)}
            >
              <option value="title">{'\uC81C\uBAA9'}</option>
              <option value="source">{'\uAE00\uC4F4\uC774'}</option>
              <option value="content">{'\uB0B4\uC6A9'}</option>
            </select>
            <input
              aria-label={'\uAC8C\uC2DC\uD310 \uAC80\uC0C9\uC5B4'}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={'\uAC80\uC0C9\uC5B4'}
            />
            <button type="submit">
              <Search size={13} aria-hidden="true" />
              {'\uAC80\uC0C9'}
            </button>
          </form>
        </section>

        <aside className="side-column" aria-label="인기 영역">
          <section className="rank-panel">
            <h2>실시간 베스트</h2>
            <div className="panel-tabs">
              <button className="is-active">조회</button>
              <button>추천</button>
              <button>댓글</button>
            </div>
            <ol>
              {popularPosts.map((post, index) => (
                <li key={`best-${post.id}`}>
                  <a href={`/posts/${post.id}`} onClick={(event) => {
                    event.preventDefault()
                    navigateTo(`/posts/${post.id}`)
                  }}>
                    <span>{index + 1}</span>
                    {post.title}
                  </a>
                </li>
              ))}
            </ol>
          </section>

          <section className="rank-panel">
            <h2>게시판 랭킹</h2>
            <ol>
              {boards.map((board, index) => (
                <li key={board.id}>
                  <a href={`/?board=${board.id}`} onClick={(event) => {
                    event.preventDefault()
                    setActiveBoard(board.id)
                    navigateTo('/')
                  }}>
                    <span>{index + 1}</span>
                    {board.name}
                  </a>
                </li>
              ))}
            </ol>
          </section>

          <section className="side-box side-box--notice">
            <h2>운영 안내</h2>
            <ul>
              {sideNotices.map((notice) => (
                <li key={notice}>{notice}</li>
              ))}
            </ul>
          </section>

          <section className="side-box">
            <h2>오늘의 키워드</h2>
            <div className="keyword-cloud">
              {todayKeywords.map((keyword) => (
                <a href={`/?q=${encodeURIComponent(keyword)}`} key={keyword} onClick={(event) => {
                  event.preventDefault()
                  setQuery(keyword)
                  navigateTo('/')
                }}>
                  {keyword}
                </a>
              ))}
            </div>
          </section>

          <section className="side-box side-box--status">
            <h2>사이트 정보</h2>
            <dl>
              <div>
                <dt>사이트명</dt>
                <dd>{businessInfo.siteName}</dd>
              </div>
              <div>
                <dt>운영자</dt>
                <dd>{businessInfo.operator}</dd>
              </div>
              <div>
                <dt>공식 URL</dt>
                <dd>jammoa.com</dd>
              </div>
              <div>
                <dt>운영 방식</dt>
                <dd>검수형</dd>
              </div>
              <div>
                <dt>문의 채널</dt>
                <dd>이메일</dd>
              </div>
              <div>
                <dt>광고 정책</dt>
                <dd>분리 표시</dd>
              </div>
            </dl>
          </section>

          <section className="side-box">
            <h2>저작권/삭제 요청</h2>
            <ul>
              <li>원문 권리자 요청은 확인 후 빠르게 조치합니다.</li>
              <li>게시글 주소와 요청 사유를 함께 보내주세요.</li>
              <li>문의: {businessInfo.email}</li>
            </ul>
          </section>

        </aside>
    </ForumFrame>
  )
}

function ForumFrame({
  activeNav,
  children,
  query,
  setQuery,
  navigateTo,
  onMainNavClick,
}: {
  activeNav: MainNavMode
  children: ReactNode
  query: string
  setQuery: (value: string) => void
  navigateTo: (path: string) => void
  onMainNavClick: (mode: MainNavMode) => void
}) {
  return (
    <div className="forum-page">
      <a className="skip-link" href="#main-content">
        본문 바로가기
      </a>
      <header className="site-header">
        <div className="utility-row">
          <div>
            <a href="/" onClick={(event) => {
              event.preventDefault()
              navigateTo('/')
            }}>전체글</a>
            <a href="/about" onClick={(event) => {
              event.preventDefault()
              navigateTo('/about')
            }}>서비스 소개</a>
            <a href="/contact" onClick={(event) => {
              event.preventDefault()
              navigateTo('/contact')
            }}>문의</a>
          </div>
          <div className="member-links">
            <a href="/privacy" onClick={(event) => {
              event.preventDefault()
              navigateTo('/privacy')
            }}>개인정보처리방침</a>
            <a href="/terms" onClick={(event) => {
              event.preventDefault()
              navigateTo('/terms')
            }}>이용약관</a>
          </div>
        </div>
        <div className="site-header__inner">
          <a href="/" className="site-logo" onClick={(event) => {
            event.preventDefault()
            navigateTo('/')
          }}>
            <strong>잼모아</strong>
            <span>재미를 모아드립니다</span>
          </a>
          <form className="hero-search" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="top-search">통합검색</label>
            <input
              id="top-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="검색어를 입력하세요"
            />
            <button type="submit">
              <Search size={14} aria-hidden="true" />
              검색
            </button>
          </form>
          <div className="site-stats">
            <span>어제 12,840개 게시글 등록</span>
            <span>총 게시판 수 5개</span>
          </div>
        </div>
        <nav className="blue-nav" aria-label="주요 메뉴">
          <div>
            {galleryLinks.map((link) => (
              <a
                className={isMainNavActive(link.mode, activeNav) ? 'is-active' : ''}
                href="/"
                key={link.label}
                onClick={(event) => {
                  event.preventDefault()
                  onMainNavClick(link.mode)
                }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </nav>
      </header>
      <main className="forum-shell" id="main-content">
        {children}
      </main>
      <AdSenseUnit slot={adSlots.bottomRight} className="adsense-unit--bottom-right" />
      <footer className="site-footer">
        <nav aria-label="사이트 정보">
          {infoPages.map((page) => (
            <a href={page.path} key={page.path} onClick={(event) => {
              event.preventDefault()
              navigateTo(page.path)
            }}>
              {page.title}
            </a>
          ))}
        </nav>
        <div className="footer-notice">
          <p>
            사이트명: {businessInfo.siteName} · 공식 URL: {businessInfo.siteUrl} · 운영자: {businessInfo.operator}
          </p>
          <p>
            잼모아는 웹상에 공개된 유머, 짤방, 이슈성 콘텐츠를 수집한 뒤 요약, 분류, 출처 정보를 중심으로 정리해 소개합니다.
            특정 개인이나 단체에 정신적, 재산적 손해를 끼칠 의도는 없으며, 문제가 되는 게시물은 운영 기준에 따라 제한합니다.
          </p>
          <p>
            초상권, 저작권, 명예훼손 등 권리 침해 소지가 있거나 게시 중단이 필요한 경우 문의해 주시면 확인 후 신속히 수정,
            비공개 또는 삭제 조치하겠습니다.
          </p>
        </div>
        <p className="footer-contact">문의: {businessInfo.email}</p>
      </footer>
    </div>
  )
}

function InfoPage({ title, paragraphs }: { title: string; paragraphs: string[] }) {
  return (
    <article className="info-page">
      <header>
        <h1>{title}</h1>
      </header>
      <div>
        {paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </article>
  )
}

function FeaturedPosts({ posts, navigateTo }: { posts: Post[]; navigateTo: (path: string) => void }) {
  if (!posts.length) return null

  return (
    <section className="featured-posts" aria-label="실시간 베스트">
      <div className="featured-posts__header">
        <strong>실시간 베스트</strong>
        <span>사진과 함께 보는 인기글</span>
      </div>
      <div className="featured-posts__grid">
        {posts.map((post) => (
          <a
            className="featured-card"
            href={`/posts/${post.id}`}
            key={post.id}
            onClick={(event) => {
              event.preventDefault()
              navigateTo(`/posts/${post.id}`)
            }}
          >
            <img src={post.image_url} alt="" loading="lazy" />
            <span>{post.title}</span>
          </a>
        ))}
      </div>
    </section>
  )
}

function PostThumbnail({ post, navigateTo }: { post: Post; navigateTo: (path: string) => void }) {
  return (
    <a
      className="post-thumb"
      href={`/posts/${post.id}`}
      aria-label={`${post.title} 썸네일`}
      onClick={(event) => {
        event.preventDefault()
        navigateTo(`/posts/${post.id}`)
      }}
    >
      <img src={post.image_url} alt="" loading="lazy" />
    </a>
  )
}

function isMainNavActive(mode: MainNavMode, activeNav: MainNavMode) {
  return mode === activeNav
}

function formatDate(value: string) {
  const date = new Date(value)
  return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

function formatCompact(value: number) {
  if (value >= 10000) return `${Math.round(value / 1000) / 10}만`
  return value.toLocaleString('ko-KR')
}

export default App

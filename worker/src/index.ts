import { boards, createSeedPosts } from './seed'

type Env = {
  DB: D1Database
  IMAGES: R2Bucket
  CRAWL_QUEUE: Queue<CrawlMessage>
  ASSETS: Fetcher
}

type CrawlMessage = {
  sourceId: string
  targetUrl: string
}

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.hostname === 'www.jammoa.com') {
      url.hostname = 'jammoa.com'
      return Response.redirect(url.toString(), request.method === 'GET' || request.method === 'HEAD' ? 301 : 308)
    }

    if (url.pathname.startsWith('/images/')) {
      return serveR2Image(env, url)
    }

    if (url.pathname === '/google51bc3364bc8630ce.html') {
      return new Response('google-site-verification: google51bc3364bc8630ce.html', {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'public, max-age=300',
        },
      })
    }

    if (url.pathname === '/sitemap.xml' && request.method === 'GET') {
      return serveSitemap(env)
    }

    const publicPostMatch = url.pathname.match(/^\/posts\/([^/]+)$/)
    if (publicPostMatch && request.method === 'GET') {
      return servePostPage(request, env, decodeURIComponent(publicPostMatch[1]))
    }

    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request)
    }

    try {
      if (url.pathname === '/api/health') {
        return json({ ok: true, service: 'jammoa-api' })
      }

      if (url.pathname === '/api/seed' && request.method === 'POST') {
        return seedDatabase(env)
      }

      if (url.pathname === '/api/posts' && request.method === 'GET') {
        return listPosts(env, url)
      }

      const postMatch = url.pathname.match(/^\/api\/posts\/([^/]+)$/)
      if (postMatch && request.method === 'GET') {
        return getPost(env, postMatch[1])
      }

      if (url.pathname === '/api/crawl/enqueue' && request.method === 'POST') {
        const body = (await request.json()) as CrawlMessage
        await env.CRAWL_QUEUE.send(body)
        return json({ ok: true, queued: body })
      }

      return json({ error: 'Not found' }, 404)
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const sources = await env.DB.prepare(
      'SELECT id, list_url FROM crawl_sources WHERE enabled = 1 ORDER BY last_crawled_at ASC LIMIT 10',
    ).all<{ id: string; list_url: string }>()

    for (const source of sources.results ?? []) {
      await env.CRAWL_QUEUE.send({ sourceId: source.id, targetUrl: source.list_url })
      await env.DB.prepare('UPDATE crawl_sources SET last_crawled_at = ? WHERE id = ?')
        .bind(new Date().toISOString(), source.id)
        .run()
    }
  },

  async queue(batch: MessageBatch<CrawlMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      await env.DB.prepare(
        'INSERT INTO crawl_jobs (id, source_id, target_url, status, message, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
        .bind(crypto.randomUUID(), message.body.sourceId, message.body.targetUrl, 'queued', 'Queued for allowlisted importer', new Date().toISOString())
        .run()
      message.ack()
    }
  },
}

type SocialPost = {
  id: string
  title: string
  summary: string | null
  body: string | null
  image_url: string | null
  source_image_url: string | null
}

async function servePostPage(request: Request, env: Env, id: string): Promise<Response> {
  const post = await env.DB.prepare(
    'SELECT id, title, summary, body, image_url, source_image_url FROM posts WHERE id = ? AND status = ?',
  ).bind(id, 'published').first<SocialPost>()

  if (!post) {
    return env.ASSETS.fetch(request)
  }

  const url = new URL(request.url)
  const canonicalUrl = `${url.origin}/posts/${encodeURIComponent(post.id)}`
  const description = toDescription(post.summary || post.body || post.title)
  const imagePath = post.image_url || post.source_image_url
  const imageUrl = imagePath ? new URL(imagePath, url.origin).toString() : null
  const pageTitle = `${post.title} | \uC7BC\uBAA8\uC544`
  // Cloudflare Assets redirects /index.html to /. Fetch the root asset directly so
  // the transformed post response remains a 200 instead of inheriting that 307.
  const assetRequest = new Request(`${url.origin}/`, request)
  const assetResponse = await env.ASSETS.fetch(assetRequest)

  let rewriter = new HTMLRewriter()
    .on('title', { element(element) { element.setInnerContent(pageTitle) } })
    .on('link[rel="canonical"]', { element(element) { element.setAttribute('href', canonicalUrl) } })
    .on('meta[name="description"]', { element(element) { element.setAttribute('content', description) } })
    .on('meta[property="og:type"]', { element(element) { element.setAttribute('content', 'article') } })
    .on('meta[property="og:title"]', { element(element) { element.setAttribute('content', post.title) } })
    .on('meta[property="og:description"]', { element(element) { element.setAttribute('content', description) } })
    .on('meta[property="og:url"]', { element(element) { element.setAttribute('content', canonicalUrl) } })

  if (imageUrl) {
    rewriter = rewriter.on('head', {
      element(element) {
        element.append(`<meta property="og:image" content="${escapeHtml(imageUrl)}" />`, { html: true })
        element.append('<meta name="twitter:card" content="summary_large_image" />', { html: true })
        element.append(`<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`, { html: true })
      },
    })
  }

  const transformed = rewriter.transform(assetResponse)
  const headers = new Headers(transformed.headers)
  headers.set('x-jammoa-social-meta', 'dynamic')
  headers.set('cache-control', 'public, max-age=60')
  return new Response(transformed.body, { status: transformed.status, headers })
}

function toDescription(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const siteOrigin = 'https://jammoa.com'

async function serveSitemap(env: Env): Promise<Response> {
  const posts = await env.DB.prepare(
    "SELECT id, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 300",
  ).all<{ id: string; published_at: string | null }>()
  const now = new Date().toISOString()
  const urls = [
    { loc: `${siteOrigin}/`, lastmod: now },
    { loc: `${siteOrigin}/about`, lastmod: now },
    { loc: `${siteOrigin}/contact`, lastmod: now },
    { loc: `${siteOrigin}/privacy`, lastmod: now },
    { loc: `${siteOrigin}/terms`, lastmod: now },
    { loc: `${siteOrigin}/content-policy`, lastmod: now },
    { loc: `${siteOrigin}/ads`, lastmod: now },
    ...((posts.results ?? []).map((post) => ({
      loc: `${siteOrigin}/posts/${encodeURIComponent(post.id)}`,
      lastmod: post.published_at || now,
    }))),
  ]
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((item) => `  <url>\n    <loc>${escapeHtml(item.loc)}</loc>\n    <lastmod>${escapeHtml(item.lastmod)}</lastmod>\n  </url>`)
    .join('\n')}\n</urlset>\n`

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  })
}

async function listPosts(env: Env, url: URL): Promise<Response> {
  const board = url.searchParams.get('board')
  const sort = url.searchParams.get('sort') ?? 'latest'
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 30), 300)
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0)

  const orderBy =
    sort === 'best'
      ? '(up_count * 3 + comment_count * 1.5 + view_count * 0.1 - report_count * 10) DESC'
      : 'published_at DESC'

  const where = board ? 'WHERE status = ? AND board_id = ?' : 'WHERE status = ?'
  const query = `SELECT * FROM posts ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
  const stmt = board
    ? env.DB.prepare(query).bind('published', board, limit, offset)
    : env.DB.prepare(query).bind('published', limit, offset)
  const result = await stmt.all()

  return json({ posts: result.results ?? [] })
}

async function getPost(env: Env, id: string): Promise<Response> {
  await env.DB.prepare('UPDATE posts SET view_count = view_count + 1 WHERE id = ? AND status = ?')
    .bind(id, 'published')
    .run()
  const post = await env.DB.prepare('SELECT * FROM posts WHERE id = ? AND status = ?').bind(id, 'published').first()
  if (!post) {
    return json({ error: 'Post not found' }, 404)
  }

  const comments = await env.DB.prepare('SELECT * FROM comments WHERE post_id = ? AND status = ? ORDER BY created_at ASC')
    .bind(id, 'visible')
    .all()

  return json({ post, comments: comments.results ?? [] })
}

async function seedDatabase(env: Env): Promise<Response> {
  for (const board of boards) {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO boards (id, name, description, sort_order) VALUES (?, ?, ?, ?)',
    )
      .bind(board.id, board.name, board.description, board.sortOrder)
      .run()
  }

  for (const post of createSeedPosts()) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO posts (
        id, board_id, title, summary, body, source_name, source_url, source_image_url,
        image_key, image_url, image_format, author_name, view_count, up_count,
        down_count, comment_count, report_count, status, content_hash, created_at, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        post.id,
        post.boardId,
        post.title,
        post.summary,
        post.body,
        post.sourceName,
        post.sourceUrl,
        post.sourceImageUrl,
        post.imageKey,
        post.imageUrl,
        'webp',
        post.sourceName,
        post.viewCount,
        post.upCount,
        0,
        post.commentCount,
        0,
        'published',
        post.contentHash,
        post.createdAt,
        post.publishedAt,
      )
      .run()
  }

  return json({ ok: true, boards: boards.length, posts: 100 })
}

async function serveR2Image(env: Env, url: URL): Promise<Response> {
  const key = decodeURIComponent(url.pathname.replace(/^\/images\//, ''))
  if (!key || key.includes('..')) {
    return new Response('Bad image key', { status: 400 })
  }

  const object = await env.IMAGES.get(key)
  if (!object) {
    return new Response('Image not found', { status: 404 })
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('content-type', object.httpMetadata?.contentType ?? 'image/webp')
  headers.set('cache-control', 'public, max-age=31536000, immutable')

  return new Response(object.body, { headers })
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders,
  })
}

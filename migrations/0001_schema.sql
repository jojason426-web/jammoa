CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  source_image_url TEXT,
  image_key TEXT,
  image_url TEXT,
  image_format TEXT NOT NULL DEFAULT 'webp',
  author_name TEXT NOT NULL DEFAULT '잼모아',
  view_count INTEGER NOT NULL DEFAULT 0,
  up_count INTEGER NOT NULL DEFAULT 0,
  down_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  report_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'review',
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id),
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible'
);

CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id),
  voter_key TEXT NOT NULL,
  value INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(post_id, voter_key)
);

CREATE TABLE IF NOT EXISTS crawl_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL UNIQUE,
  list_url TEXT NOT NULL,
  board_id TEXT NOT NULL REFERENCES boards(id),
  mode TEXT NOT NULL DEFAULT 'metadata-only',
  enabled INTEGER NOT NULL DEFAULT 0,
  respect_robots INTEGER NOT NULL DEFAULT 1,
  last_crawled_at TEXT
);

CREATE TABLE IF NOT EXISTS crawl_jobs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES crawl_sources(id),
  target_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  message TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS blocked_terms (
  id TEXT PRIMARY KEY,
  term TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL DEFAULT 'policy'
);

CREATE INDEX IF NOT EXISTS idx_posts_board_status_time ON posts(board_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_status_score ON posts(status, up_count DESC, comment_count DESC, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_time ON comments(post_id, created_at ASC);

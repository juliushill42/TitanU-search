-- TitanSearch schema
-- Run: psql $PG_DSN -f schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Documents (crawled/indexed pages)
CREATE TABLE IF NOT EXISTS documents (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title        TEXT NOT NULL,
    url          TEXT NOT NULL UNIQUE,
    snippet      TEXT,
    content      TEXT,
    domain       TEXT,
    content_type TEXT DEFAULT 'web',
    favicon      TEXT,
    published_at TIMESTAMPTZ DEFAULT NOW(),
    crawled_at   TIMESTAMPTZ DEFAULT NOW(),
    score_base   FLOAT DEFAULT 0.5,
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(snippet, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'C')
    ) STORED
);

CREATE INDEX IF NOT EXISTS idx_documents_search ON documents USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_documents_domain ON documents(domain);
CREATE INDEX IF NOT EXISTS idx_documents_published ON documents(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_content_type ON documents(content_type);

-- Feedback
CREATE TABLE IF NOT EXISTS feedback (
    id         SERIAL PRIMARY KEY,
    session_id TEXT,
    query      TEXT,
    doc_id     UUID REFERENCES documents(id),
    mode       TEXT,
    type       TEXT CHECK (type IN ('helpful','not_helpful','report')),
    comment    TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_session ON feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_feedback_doc ON feedback(doc_id);

-- Search history
CREATE TABLE IF NOT EXISTS search_history (
    id         SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    query      TEXT NOT NULL,
    mode       TEXT NOT NULL,
    latency_ms INT,
    result_count INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_history_session ON search_history(session_id);
CREATE INDEX IF NOT EXISTS idx_history_created ON search_history(created_at DESC);

-- Sample seed data
INSERT INTO documents (title, url, snippet, domain, content_type, published_at) VALUES
  ('Rust Memory Safety Without GC', 'https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html',
   'Rust achieves memory safety through its ownership system, borrowing rules, and lifetimes — all enforced at compile time with zero runtime overhead.',
   'doc.rust-lang.org', 'web', NOW() - INTERVAL '2 days'),
  ('Go Performance Benchmarks 2024', 'https://benchmarksgame-team.pages.debian.net/benchmarksgame/which-programs-are-fastest.html',
   'Comprehensive performance benchmarks comparing Go, Rust, C++, and other languages across multiple workloads.',
   'benchmarksgame-team.pages.debian.net', 'web', NOW() - INTERVAL '10 days'),
  ('Sovereign AI Infrastructure', 'https://titanu.ai/sovereign-stack',
   'Building AI infrastructure you fully own: local inference, sovereign compute mesh, zero proprietary lock-in.',
   'titanu.ai', 'web', NOW() - INTERVAL '1 day')
ON CONFLICT (url) DO NOTHING;

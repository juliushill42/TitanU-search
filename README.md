# TitanSearch

Sovereign search engine with Classic / AI / Hybrid modes.  
Built on Go + TypeScript + Tailwind. IP: Julius Cameron Hill / TitanU AI LLC.

## Stack
- **API**: Go (Gin), Postgres (pgvector + full-text), Redis (cache)
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **AI Synthesis**: OpenAI GPT-4o-mini (optional; falls back to mock)
- **Infra**: Docker Compose, scratch-based container

## Quick start

```bash
cp .env.example .env
# Edit .env — add OPENAI_KEY if you want live AI answers

# Option A: Docker (recommended)
make docker-up
# API: http://localhost:8080
# Web: http://localhost:3000

# Option B: Local dev
# Terminal 1
make api

# Terminal 2
cd frontend && npm install && npm run dev

# Apply DB schema
make migrate
```

## Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/query | Search (mode: classic\|ai\|hybrid) |
| POST | /api/v1/feedback | Submit result feedback |
| GET  | /api/v1/sources/:id | Get source detail |
| GET  | /api/v1/history | Search history |
| POST | /api/v1/mode | Persist mode preference |
| GET  | /health | Health check |

## Search modes
- **Classic** — web results only, zero AI card
- **AI** — AI answer card with inline citations + web results below
- **Hybrid** — AI sidebar + full web results grid

## IP Notice
© 2026 Julius Cameron Hill / TitanU AI LLC. All rights reserved.  
Patents pending: JCH-2026-001 through JCH-2026-011.

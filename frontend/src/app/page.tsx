'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────
type Mode = 'classic' | 'ai' | 'hybrid'
type TimeRange = 'all' | 'day' | 'week' | 'month' | 'year'
type ContentType = '' | 'web' | 'news' | 'code' | 'academic'

interface Doc {
  id: string; title: string; url: string; snippet: string
  domain: string; published_at: string; score: number
  content_type: string; favicon: string
}
interface Citation { doc_id: string; url: string; title: string; snippet: string; index: number }
interface Answer {
  text: string; citations: Citation[]; confidence: number
  uncertain: boolean; follow_ups: string[]
}
interface SearchResponse {
  query: string; mode: Mode; results: Doc[]; answer?: Answer
  latency_ms: number; total: number
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1'

async function doSearch(query: string, mode: Mode, timeRange: TimeRange, contentType: ContentType): Promise<SearchResponse> {
  const res = await fetch(`${API}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, mode, page: 1, filters: { time_range: timeRange, content_type: contentType } }),
  })
  if (!res.ok) throw new Error('Search failed')
  return res.json()
}

async function sendFeedback(payload: object) {
  fetch(`${API}/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {})
}

// ── Utils ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const d = new Date(iso); const now = Date.now(); const diff = now - d.getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`
}

function stripHttp(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

// ── Constants ───────────────────────────────────────────────────────────────
const MODES: { id: Mode; label: string; desc: string; color: string }[] = [
  { id: 'classic', label: 'Classic', desc: 'Links only, no AI', color: '#22d3ee' },
  { id: 'hybrid',  label: 'Hybrid',  desc: 'AI + web results',  color: '#34d399' },
  { id: 'ai',      label: 'AI',      desc: 'AI answer with sources', color: '#a78bfa' },
]

const SUGGESTIONS = [
  'How does Rust handle memory safety without GC?',
  'Go vs Rust performance benchmarks 2024',
  'Sovereign AI infrastructure architecture',
  'WebAssembly use cases in production',
  'Vector database comparison 2024',
]

// ── Components ──────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-titan-card border border-titan-border">
      {MODES.map(m => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className="relative px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
          style={{
            color: mode === m.id ? m.color : '#6b6b8a',
            background: mode === m.id ? 'rgba(255,255,255,0.06)' : 'transparent',
            boxShadow: mode === m.id ? `0 0 0 1px ${m.color}33` : 'none',
          }}
        >
          {m.label}
          {mode === m.id && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
          )}
        </button>
      ))}
    </div>
  )
}

function SearchBar({
  value, onChange, onSearch, loading, mode
}: {
  value: string; onChange: (v: string) => void
  onSearch: () => void; loading: boolean; mode: Mode
}) {
  const modeColor = MODES.find(m => m.id === mode)?.color ?? '#6c63ff'
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { ref.current?.focus() }, [])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSearch()
  }

  return (
    <div className="relative group">
      <div
        className="flex items-center gap-3 px-5 py-4 rounded-2xl border bg-titan-card transition-all duration-300"
        style={{ borderColor: value ? modeColor + '66' : '#1e1e2e', boxShadow: value ? `0 0 24px ${modeColor}18` : 'none' }}
      >
        {/* Search icon */}
        <svg className="w-5 h-5 shrink-0" style={{ color: value ? modeColor : '#6b6b8a' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>

        <input
          ref={ref}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Search anything..."
          className="flex-1 bg-transparent outline-none text-titan-text placeholder-titan-muted text-lg font-body"
        />

        {value && (
          <button onClick={() => onChange('')} className="text-titan-muted hover:text-titan-text transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}

        <button
          onClick={onSearch}
          disabled={!value.trim() || loading}
          className="px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-40"
          style={{ background: modeColor + '22', color: modeColor, border: `1px solid ${modeColor}44` }}
        >
          {loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : 'Search'}
        </button>
      </div>
    </div>
  )
}

function FilterBar({
  timeRange, contentType, onTime, onContent
}: {
  timeRange: TimeRange; contentType: ContentType
  onTime: (t: TimeRange) => void; onContent: (c: ContentType) => void
}) {
  const times: TimeRange[] = ['all', 'day', 'week', 'month', 'year']
  const contents: { v: ContentType; l: string }[] = [
    { v: '', l: 'All' }, { v: 'web', l: 'Web' }, { v: 'news', l: 'News' },
    { v: 'code', l: 'Code' }, { v: 'academic', l: 'Academic' }
  ]

  const btnCls = (active: boolean) =>
    `px-3 py-1 rounded-lg text-xs font-medium transition-all duration-150 ${
      active ? 'bg-titan-accent text-white' : 'text-titan-muted hover:text-titan-text bg-titan-card border border-titan-border'
    }`

  return (
    <div className="flex items-center gap-6 text-sm">
      <div className="flex items-center gap-1.5">
        <span className="text-titan-muted text-xs mr-1">Time:</span>
        {times.map(t => (
          <button key={t} onClick={() => onTime(t)} className={btnCls(timeRange === t)}>
            {t === 'all' ? 'Any' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-titan-muted text-xs mr-1">Type:</span>
        {contents.map(c => (
          <button key={c.v} onClick={() => onContent(c.v)} className={btnCls(contentType === c.v)}>
            {c.l}
          </button>
        ))}
      </div>
    </div>
  )
}

function AIAnswerCard({ answer, query }: { answer: Answer; query: string }) {
  const [expanded, setExpanded] = useState(false)
  const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | null>(null)

  // Render citations inline [N] → linked superscripts
  const renderText = (text: string) => {
    const parts = text.split(/(\[\d+\])/g)
    return parts.map((part, i) => {
      const match = part.match(/\[(\d+)\]/)
      if (match) {
        const n = parseInt(match[1])
        const cit = answer.citations?.find(c => c.index === n)
        return (
          <a key={i} href={cit?.url ?? '#'} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-4 h-4 rounded text-xs bg-titan-accent/20 text-titan-glow hover:bg-titan-accent/40 transition-colors mx-0.5 no-underline"
            title={cit?.title}
          >[{n}]</a>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className="rounded-2xl border border-titan-border bg-titan-card overflow-hidden animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-titan-border bg-titan-surface">
        <div className="w-2 h-2 rounded-full bg-titan-ai animate-pulse" />
        <span className="text-xs font-medium text-titan-ai uppercase tracking-widest">AI Answer</span>
        {answer.uncertain && (
          <span className="ml-auto text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md">Low confidence</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-titan-muted">{Math.round(answer.confidence * 100)}% confidence</span>
        </div>
      </div>

      {/* Answer body */}
      <div className="px-5 py-4">
        <p className="text-titan-text leading-relaxed text-sm">
          {renderText(answer.text)}
        </p>

        {/* Citations */}
        {answer.citations?.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 text-xs text-titan-muted hover:text-titan-text transition-colors"
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="m6 9 6 6 6-6" />
              </svg>
              {answer.citations.length} source{answer.citations.length !== 1 ? 's' : ''}
            </button>
            {expanded && (
              <div className="mt-3 space-y-2">
                {answer.citations.map(c => (
                  <a key={c.doc_id} href={c.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-3 p-3 rounded-xl bg-titan-surface border border-titan-border hover:border-titan-accent/40 transition-colors group no-underline"
                  >
                    <span className="shrink-0 text-xs font-mono text-titan-accent bg-titan-accent/10 w-5 h-5 rounded flex items-center justify-center">{c.index}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-titan-text group-hover:text-titan-glow transition-colors truncate">{c.title}</p>
                      <p className="text-xs text-titan-muted truncate mt-0.5">{stripHttp(c.url)}</p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Follow-ups */}
        {answer.follow_ups?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-titan-border">
            <p className="text-xs text-titan-muted mb-2">Related questions</p>
            <div className="flex flex-wrap gap-2">
              {answer.follow_ups.map((fu, i) => (
                <button key={i}
                  className="text-xs text-titan-text bg-titan-surface border border-titan-border px-3 py-1.5 rounded-lg hover:border-titan-accent/40 hover:text-titan-glow transition-all"
                >
                  {fu}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Feedback */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-titan-muted">Helpful?</span>
          {(['helpful', 'not_helpful'] as const).map(f => (
            <button key={f} onClick={() => { setFeedback(f); sendFeedback({ type: f, query, mode: 'ai' }) }}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                feedback === f ? 'border-titan-accent text-titan-accent bg-titan-accent/10' : 'border-titan-border text-titan-muted hover:border-titan-muted'
              }`}
            >
              {f === 'helpful' ? '👍 Yes' : '👎 No'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ResultCard({ doc, index }: { doc: Doc; index: number }) {
  const [feedback, setFeedback] = useState<string | null>(null)

  return (
    <div
      className="group animate-fade-up"
      style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'both', opacity: 0 }}
    >
      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="block no-underline">
        <div className="flex items-center gap-2 mb-1">
          {doc.favicon && (
            <img src={doc.favicon} alt="" className="w-4 h-4 rounded-sm" onError={e => (e.currentTarget.style.display = 'none')} />
          )}
          <span className="text-xs text-titan-muted">{stripHttp(doc.url)}</span>
          <span className="text-xs text-titan-border mx-1">·</span>
          <span className="text-xs text-titan-muted">{timeAgo(doc.published_at)}</span>
          {doc.content_type && doc.content_type !== 'web' && (
            <span className="text-xs px-2 py-0.5 rounded-md bg-titan-card border border-titan-border text-titan-muted capitalize">{doc.content_type}</span>
          )}
        </div>
        <h3 className="text-[15px] font-medium text-titan-text group-hover:text-titan-glow transition-colors leading-snug mb-1">
          {doc.title}
        </h3>
        <p className="text-sm text-titan-muted leading-relaxed">{doc.snippet}</p>
      </a>
      <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {(['helpful', 'not_helpful', 'report'] as const).map(f => (
          <button key={f} onClick={e => { e.preventDefault(); setFeedback(f); sendFeedback({ type: f, doc_id: doc.id }) }}
            className={`text-xs text-titan-muted hover:text-titan-text transition-colors ${feedback === f ? 'text-titan-accent' : ''}`}
          >
            {f === 'helpful' ? '👍' : f === 'not_helpful' ? '👎' : '🚩'}
          </button>
        ))}
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-32 rounded-md bg-titan-card animate-pulse" />
          <div className="h-4 w-3/4 rounded-md bg-titan-card animate-pulse" />
          <div className="h-3 w-full rounded-md bg-titan-card animate-pulse" />
          <div className="h-3 w-4/5 rounded-md bg-titan-card animate-pulse" />
        </div>
      ))}
    </div>
  )
}

// ── Home Page ───────────────────────────────────────────────────────────────
function HomePage({ onSearch, mode, setMode }: { onSearch: (q: string) => void; mode: Mode; setMode: (m: Mode) => void }) {
  const [q, setQ] = useState('')
  const modeColor = MODES.find(m => m.id === mode)?.color ?? '#6c63ff'

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 pb-24 bg-titan-bg bg-grid-pattern">
      {/* Logo */}
      <div className="mb-12 text-center">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: modeColor + '22', border: `1px solid ${modeColor}44` }}>
            <svg className="w-5 h-5" style={{ color: modeColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <h1 className="text-3xl font-display font-bold text-titan-text tracking-tight">TITAN<span style={{ color: modeColor }}>SEARCH</span></h1>
        </div>
        <p className="text-titan-muted text-sm">Search on your terms. Classic, AI, or both.</p>
      </div>

      {/* Search */}
      <div className="w-full max-w-2xl space-y-4">
        <SearchBar value={q} onChange={setQ} onSearch={() => q.trim() && onSearch(q)} loading={false} mode={mode} />

        {/* Mode toggle */}
        <div className="flex justify-center">
          <ModeToggle mode={mode} onChange={setMode} />
        </div>

        {/* Suggestions */}
        <div className="pt-4">
          <p className="text-xs text-titan-muted text-center mb-3">Try these</p>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => { setQ(s); onSearch(s) }}
                className="text-xs text-titan-muted border border-titan-border bg-titan-card px-3 py-1.5 rounded-full hover:text-titan-text hover:border-titan-accent/40 transition-all"
              >{s}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Mode descriptions */}
      <div className="mt-12 grid grid-cols-3 gap-4 w-full max-w-2xl">
        {MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className="text-center p-4 rounded-xl border transition-all duration-200"
            style={{
              borderColor: mode === m.id ? m.color + '66' : '#1e1e2e',
              background: mode === m.id ? m.color + '0a' : 'transparent',
            }}
          >
            <div className="text-sm font-medium mb-1" style={{ color: m.color }}>{m.label}</div>
            <div className="text-xs text-titan-muted">{m.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Results Page ─────────────────────────────────────────────────────────────
function ResultsPage({
  query, mode, setMode, results, loading, error, latency,
  onSearch, onNewSearch
}: {
  query: string; mode: Mode; setMode: (m: Mode) => void
  results: SearchResponse | null; loading: boolean; error: string | null
  latency: number; onSearch: (q: string) => void; onNewSearch: () => void
}) {
  const [q, setQ] = useState(query)
  const modeColor = MODES.find(m => m.id === mode)?.color ?? '#6c63ff'

  useEffect(() => { setQ(query) }, [query])

  return (
    <div className="min-h-screen bg-titan-bg">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-titan-border bg-titan-bg/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onClick={onNewSearch} className="text-titan-text font-display font-bold text-lg shrink-0 hover:text-titan-glow transition-colors">
            T<span style={{ color: modeColor }}>S</span>
          </button>
          <div className="flex-1 max-w-2xl">
            <SearchBar value={q} onChange={setQ} onSearch={() => q.trim() && onSearch(q)} loading={loading} mode={mode} />
          </div>
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Meta */}
        {results && !loading && (
          <div className="flex items-center gap-3 mb-5 text-xs text-titan-muted">
            <span className="font-mono">{results.total} results</span>
            <span className="text-titan-border">·</span>
            <span className="font-mono">{latency}ms</span>
            <span className="text-titan-border">·</span>
            <span className="capitalize" style={{ color: modeColor }}>{mode} mode</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-6">{error}</div>
        )}

        {/* Layout: AI card top in AI mode, sidebar in hybrid */}
        {loading ? (
          <div className="max-w-2xl"><Skeleton /></div>
        ) : results ? (
          mode === 'hybrid' ? (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,380px] gap-6">
              {/* Results */}
              <div className="space-y-7">
                {results.results.map((doc, i) => (
                  <ResultCard key={doc.id} doc={doc} index={i} />
                ))}
              </div>
              {/* AI sidebar */}
              {results.answer && (
                <div className="space-y-4">
                  <AIAnswerCard answer={results.answer} query={query} />
                </div>
              )}
            </div>
          ) : mode === 'ai' ? (
            <div className="max-w-2xl space-y-6">
              {results.answer && <AIAnswerCard answer={results.answer} query={query} />}
              <div className="space-y-7 pt-2">
                {results.results.map((doc, i) => (
                  <ResultCard key={doc.id} doc={doc} index={i} />
                ))}
              </div>
            </div>
          ) : (
            // Classic
            <div className="max-w-2xl space-y-7">
              {results.results.map((doc, i) => (
                <ResultCard key={doc.id} doc={doc} index={i} />
              ))}
            </div>
          )
        ) : null}
      </div>
    </div>
  )
}

// ── Root ─────────────────────────────────────────────────────────────────────
export default function TitanSearch() {
  const [page, setPage] = useState<'home' | 'results'>('home')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<Mode>('hybrid')
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [latency, setLatency] = useState(0)
  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [contentType, setContentType] = useState<ContentType>('')

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q); setPage('results'); setLoading(true); setError(null)
    const start = performance.now()
    try {
      const res = await doSearch(q, mode, timeRange, contentType)
      setResults(res); setLatency(Math.round(performance.now() - start))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [mode, timeRange, contentType])

  const handleModeChange = useCallback(async (m: Mode) => {
    setMode(m)
    if (query && page === 'results') {
      setLoading(true); setError(null)
      try {
        const res = await doSearch(query, m, timeRange, contentType)
        setResults(res)
      } catch (e: any) { setError(e.message) }
      finally { setLoading(false) }
    }
  }, [query, page, timeRange, contentType])

  if (page === 'home') {
    return <HomePage onSearch={handleSearch} mode={mode} setMode={setMode} />
  }

  return (
    <ResultsPage
      query={query} mode={mode} setMode={handleModeChange}
      results={results} loading={loading} error={error} latency={latency}
      onSearch={handleSearch} onNewSearch={() => setPage('home')}
    />
  )
}

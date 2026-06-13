export type SearchMode = 'classic' | 'ai' | 'hybrid'

export interface SearchFilter {
  time_range: 'day' | 'week' | 'month' | 'year' | 'all'
  domains: string[]
  content_type: 'web' | 'news' | 'code' | 'academic' | ''
}

export interface Doc {
  id: string
  title: string
  url: string
  snippet: string
  domain: string
  published_at: string
  score: number
  content_type: string
  favicon: string
}

export interface Citation {
  doc_id: string
  url: string
  title: string
  snippet: string
  index: number
}

export interface Answer {
  text: string
  citations: Citation[]
  confidence: number
  uncertain: boolean
  follow_ups: string[]
}

export interface SearchResponse {
  query: string
  mode: SearchMode
  results: Doc[]
  answer?: Answer
  latency_ms: number
  total: number
}

export interface FeedbackRequest {
  session_id: string
  query: string
  doc_id: string
  mode: string
  type: 'helpful' | 'not_helpful' | 'report'
  comment?: string
}

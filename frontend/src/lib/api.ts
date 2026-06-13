import type { SearchFilter, SearchMode, SearchResponse, FeedbackRequest } from './types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1'

export async function search(
  query: string,
  mode: SearchMode,
  page: number = 1,
  filters: Partial<SearchFilter> = {}
): Promise<SearchResponse> {
  const res = await fetch(`${BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, mode, page, filters }),
  })
  if (!res.ok) throw new Error(`Search failed: ${res.status}`)
  return res.json()
}

export async function submitFeedback(req: FeedbackRequest): Promise<void> {
  await fetch(`${BASE}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
}

export async function setMode(mode: SearchMode, sessionId: string): Promise<void> {
  await fetch(`${BASE}/mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, session_id: sessionId }),
  })
}

export async function getSource(id: string) {
  const res = await fetch(`${BASE}/sources/${id}`)
  if (!res.ok) throw new Error('Source not found')
  return res.json()
}

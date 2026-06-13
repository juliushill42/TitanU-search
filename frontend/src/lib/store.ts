import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SearchMode, SearchResponse, SearchFilter } from './types'
import { search as apiSearch, setMode as apiSetMode } from './api'

interface SearchStore {
  query: string
  mode: SearchMode
  results: SearchResponse | null
  loading: boolean
  error: string | null
  page: number
  filters: Partial<SearchFilter>
  sessionId: string

  setQuery: (q: string) => void
  setMode: (m: SearchMode) => void
  setFilters: (f: Partial<SearchFilter>) => void
  executeSearch: (q?: string) => Promise<void>
  nextPage: () => void
  reset: () => void
}

const genSessionId = () => Math.random().toString(36).slice(2)

export const useSearchStore = create<SearchStore>()(
  persist(
    (set, get) => ({
      query: '',
      mode: 'hybrid',
      results: null,
      loading: false,
      error: null,
      page: 1,
      filters: { time_range: 'all', content_type: '' },
      sessionId: genSessionId(),

      setQuery: (q) => set({ query: q }),

      setMode: async (m) => {
        set({ mode: m })
        const { sessionId, query, results } = get()
        await apiSetMode(m, sessionId)
        if (results && query) {
          get().executeSearch(query)
        }
      },

      setFilters: (f) => {
        set({ filters: { ...get().filters, ...f } })
        get().executeSearch()
      },

      executeSearch: async (q) => {
        const { query: storeQ, mode, page, filters } = get()
        const finalQ = q ?? storeQ
        if (!finalQ.trim()) return

        set({ loading: true, error: null, query: finalQ })
        try {
          const res = await apiSearch(finalQ, mode, page, filters)
          set({ results: res, loading: false })
        } catch (e: any) {
          set({ error: e.message, loading: false })
        }
      },

      nextPage: () => {
        const { page } = get()
        set({ page: page + 1 })
        get().executeSearch()
      },

      reset: () => set({ query: '', results: null, error: null, page: 1 }),
    }),
    {
      name: 'titan-search',
      partialState: (s) => ({ mode: s.mode, sessionId: s.sessionId }),
    } as any
  )
)

/**
 * In-memory Zustand store for audit filter persistence (Phase 3).
 * Retains filter selections when navigating away and back.
 * DEFAULT: NOT persisted to localStorage (memory only per spec).
 */

import { create } from 'zustand'

export const DEFAULT_VISIBLE_COLUMNS = ['time', 'status', 'action', 'resource', 'actor', 'requestId']

interface AuditFilterMemory {
  status: string
  action: string
  search: string
  from: string
  to: string
  page: number
  visibleColumns: string[]
}

interface AuditFilterStore extends AuditFilterMemory {
  save: (filters: Partial<AuditFilterMemory>) => void
  reset: () => void
}

const INITIAL: AuditFilterMemory = {
  status: '',
  action: '',
  search: '',
  from: '',
  to: '',
  page: 1,
  visibleColumns: DEFAULT_VISIBLE_COLUMNS,
}

export const useAuditFilterStore = create<AuditFilterStore>((set) => ({
  ...INITIAL,
  save: (filters) => set((state) => ({ ...state, ...filters })),
  reset: () => set(INITIAL),
}))

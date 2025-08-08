'use client'

import { useEffect, useState, useCallback } from 'react'

export type LootEntry = { createdAt: string; data: any }
const KEY = 'rpg_loot_history_v1'

export function useLootHistory() {
  const [entries, setEntries] = useState<LootEntry[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setEntries(JSON.parse(raw))
    } catch {}
  }, [])

  const persist = useCallback((list: LootEntry[]) => {
    setEntries(list)
    try { localStorage.setItem(KEY, JSON.stringify(list)) } catch {}
  }, [])

  const addEntry = useCallback((entry: LootEntry) => {
    const next = [entry, ...entries].slice(0, 100)
    persist(next)
  }, [entries, persist])

  const clear = useCallback(() => persist([]), [persist])

  return { entries, addEntry, clear }
}

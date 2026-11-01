import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

/**
 * Listen to a private Realtime channel (e.g. "household:<id>" or "user:<id>").
 * The database sends a small "changed" message naming the table; the data itself is then
 * re-read through the normal, RLS-protected queries. Messages arriving close together are
 * grouped, so a bill with 4 shares triggers one reload, not five.
 */
export function useLiveChannel(topic: string | null, onChange: (tables: Set<string>) => void) {
  const handler = useRef(onChange)
  useEffect(() => {
    handler.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!topic) return
    let pending = new Set<string>()
    let timer: number | undefined
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    void (async () => {
      // Private channels are authorised with the signed-in person's token
      await supabase.realtime.setAuth()
      if (cancelled) return
      channel = supabase
        .channel(topic, { config: { private: true } })
        .on('broadcast', { event: 'changed' }, (message) => {
          const table = (message.payload as { table?: string } | undefined)?.table
          if (table) pending.add(table)
          window.clearTimeout(timer)
          timer = window.setTimeout(() => {
            const tables = pending
            pending = new Set()
            handler.current(tables)
          }, 300)
        })
        .subscribe()
    })()

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [topic])
}

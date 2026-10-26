import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { friendlyHouseholdError } from '../../lib/householdErrors'
import { addDays, type ISODate } from '../../lib/dates'
import type { Chore } from '../../lib/bills'
import type { HouseActions, NewChore } from './house'

// Until Realtime (Phase 6), chores re-load this often while the app is on screen, and whenever it comes back.
const POLL_MS = 30_000

type ChoreActions = Pick<HouseActions, 'addChore' | 'completeChore' | 'reopenChore' | 'deleteChore'>

type Row = {
  id: string
  title: string
  emoji: string | null
  assignee_id: string | null
  due_date: string
  recurrence: string
  done_at: string | null
  created_by: string | null
}

const toChore = (r: Row): Chore => ({
  id: r.id,
  title: r.title,
  emoji: r.emoji ?? '🧹',
  assigneeId: r.assignee_id ?? '',
  dueDate: r.due_date,
  recurrence: r.recurrence === 'daily' || r.recurrence === 'weekly' ? r.recurrence : 'none',
  doneAt: r.done_at,
  createdBy: r.created_by ?? undefined,
})

/** Live chores for a household: open ones, plus anything done in the last week. */
export function useLiveChores(householdId: string | null, today: ISODate, toast: (m: string) => void) {
  const [chores, setChores] = useState<Chore[] | null>(null)

  const reload = useCallback(async () => {
    if (!householdId) return
    const { data, error } = await supabase
      .from('chores')
      .select('id, title, emoji, assignee_id, due_date, recurrence, done_at, created_by')
      .eq('household_id', householdId)
      .or(`done_at.is.null,due_date.gte.${addDays(today, -7)}`)
      .order('due_date')
    if (error) return
    setChores((data as Row[]).map(toChore))
  }, [householdId, today])

  useEffect(() => {
    // reload() sets state only after the network call returns
    // eslint-disable-next-line react/set-state-in-effect
    void reload()
    if (!householdId) return
    const tick = () => {
      if (document.visibilityState === 'visible') void reload()
    }
    const timer = window.setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [householdId, reload])

  const actions = useMemo<ChoreActions>(() => {
    /** Show the change right away, then save; if saving fails, reload and explain. */
    const run = async (call: () => PromiseLike<{ error: { message?: string } | null }>, optimistic?: (all: Chore[]) => Chore[], ok?: string) => {
      if (optimistic) setChores((all) => (all ? optimistic(all) : all))
      const { error } = await call()
      if (error) toast(friendlyHouseholdError(error))
      else if (ok) toast(ok)
      await reload()
      return error ? friendlyHouseholdError(error) : null
    }
    const setDone = (id: string, done: boolean) => (all: Chore[]) =>
      all.map((c) => (c.id === id ? { ...c, doneAt: done ? new Date().toISOString() : null } : c))

    return {
      addChore: (n: NewChore) => {
        if (!householdId) return
        void run(
          () =>
            supabase.rpc('create_chore', {
              p_household: householdId,
              p_title: n.title,
              p_emoji: n.emoji,
              p_assignee: n.assigneeId,
              p_due_date: n.dueDate,
              p_recurrence: n.recurrence,
            }),
          undefined,
          `${n.title} added`,
        )
      },
      completeChore: (id) => {
        void run(() => supabase.rpc('complete_chore', { p_chore: id }), setDone(id, true), 'Marked as done 🎉')
      },
      reopenChore: (id) => {
        void run(() => supabase.rpc('reopen_chore', { p_chore: id }), setDone(id, false))
      },
      deleteChore: (id) => run(() => supabase.rpc('delete_chore', { p_chore: id }), (all) => all.filter((c) => c.id !== id), 'Chore deleted'),
    }
  }, [householdId, reload, toast])

  return { chores, actions }
}

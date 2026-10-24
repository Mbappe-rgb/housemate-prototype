import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export function LogOutButton() {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      className="link-btn"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await supabase.auth.signOut()
        // The router sends them to Welcome once the session is gone.
        setBusy(false)
      }}
    >
      {busy ? 'Logging out…' : 'Log out'}
    </button>
  )
}

import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { THEMES, useTheme, type Theme } from '../../app/theme'
import { DemoHouseProvider } from '../house/DemoHouseProvider'
import type { DemoState } from '../house/demoData'
import { AppShell } from '../app/AppShell'

const STATES: [DemoState, string][] = [
  ['owe', 'You owe'],
  ['late', 'Past due'],
  ['settled', 'All settled'],
]

/**
 * /demo: the full app with the prototype's sample data, for design review.
 * The "Prototype" pill switches palette and data state. Nothing here touches the database.
 */
export function DemoApp() {
  const [theme, setTheme] = useState<Theme>('lime')
  const [state, setState] = useState<DemoState>('owe')
  const [open, setOpen] = useState(false)
  useTheme(theme)

  return (
    <DemoHouseProvider state={state}>
      <div className="demo">
        <AppShell />
      </div>
      <button type="button" className="pbtn" onClick={() => setOpen(true)} aria-label="Demo controls">
        <Icon name="settings" size={13} />
        Demo
      </button>
      {open && (
        <Sheet label="Demo controls" onClose={() => setOpen(false)}>
          <div className="top">
            <div>
              <b>Demo controls</b>
              <small>Sample data only. Nothing is saved.</small>
            </div>
          </div>
          <h4>Palette</h4>
          <div className="chips">
            {THEMES.map(([key, label]) => (
              <button key={key} type="button" className={`ch ${theme === key ? 'on' : ''}`} aria-pressed={theme === key} onClick={() => setTheme(key)}>
                {label}
              </button>
            ))}
          </div>
          <h4>Data</h4>
          <div className="chips">
            {STATES.map(([key, label]) => (
              <button key={key} type="button" className={`ch ${state === key ? 'on' : ''}`} aria-pressed={state === key} onClick={() => setState(key)}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="btn" style={{ marginTop: 18 }} onClick={() => setOpen(false)}>
            Done
          </button>
        </Sheet>
      )}
    </DemoHouseProvider>
  )
}

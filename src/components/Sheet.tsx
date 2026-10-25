import { useEffect, useRef, type ReactNode } from 'react'

type SheetProps = {
  label: string
  onClose: () => void
  children: ReactNode
}

/** Close on Escape and keep focus inside while open; return focus when closed. */
function useDialogFocus(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const node = ref.current
    const first = node?.querySelector<HTMLElement>('input, select, textarea, button:not([data-skip-focus])')
    ;(first ?? node)?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.({ preventScroll: true })
    }
    // onClose changes identity every render; we only want this on open/close
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return ref
}

/** Bottom sheet with a grab handle. Tap outside or press Escape to close. */
export function Sheet({ label, onClose, children }: SheetProps) {
  const ref = useDialogFocus(onClose)
  return (
    <div className="psheet" onClick={onClose}>
      <div
        ref={ref}
        className="pp"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gr" />
        {children}
      </div>
    </div>
  )
}

/** Centered pop-up for confirmations ("Is it really done?", "Leave household?"). */
export function Dialog({
  label,
  onClose,
  children,
  alert = false,
}: SheetProps & { alert?: boolean }) {
  const ref = useDialogFocus(onClose)
  return (
    <div className="psheet mid" onClick={onClose}>
      <div
        ref={ref}
        className="pop"
        role={alert ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

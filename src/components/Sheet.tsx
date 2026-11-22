import { useEffect, useRef, type ReactNode } from 'react'

/** Close on Escape, keep focus inside while open, return focus when closed, lock page scroll. */
function useDialogFocus(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const node = ref.current
    const first = node?.querySelector<HTMLElement>('input:not([type=file]), select, textarea, button:not([data-skip-focus])')
    ;(first ?? node)?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current()
    }
    document.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.({ preventScroll: true })
    }
  }, [])
  return ref
}

/**
 * Swipe down to close (style guide): on touch only when the sheet is scrolled to the top,
 * or by dragging the grab handle with a mouse.
 */
function useSwipeToClose(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void) {
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])
  useEffect(() => {
    const sheet = ref.current
    if (!sheet) return
    let startY = 0
    let dy = 0
    let active = false

    const begin = (target: EventTarget | null, y: number) => {
      const el = target as HTMLElement | null
      if (!el || el.closest('input, textarea, select, .mnu')) return
      if (sheet.scrollTop > 0 && !el.closest('.gr')) return
      startY = y
      dy = 0
      active = true
    }
    const move = (y: number) => {
      if (!active) return
      dy = Math.max(0, y - startY)
      sheet.style.transition = 'none'
      sheet.style.transform = dy ? `translateY(${dy}px)` : ''
    }
    const end = () => {
      if (!active) return
      active = false
      sheet.style.transition = 'transform .2s'
      if (dy > 90) {
        sheet.style.transform = 'translateY(100%)'
        window.setTimeout(() => close.current(), 180)
      } else {
        sheet.style.transform = ''
      }
    }

    const onTouchStart = (e: TouchEvent) => begin(e.target, e.touches[0].clientY)
    const onTouchMove = (e: TouchEvent) => move(e.touches[0].clientY)
    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.gr')) begin(e.target, e.clientY)
    }
    const onMouseMove = (e: MouseEvent) => move(e.clientY)
    sheet.addEventListener('touchstart', onTouchStart, { passive: true })
    sheet.addEventListener('touchmove', onTouchMove, { passive: true })
    sheet.addEventListener('touchend', end)
    sheet.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', end)
    return () => {
      sheet.removeEventListener('touchstart', onTouchStart)
      sheet.removeEventListener('touchmove', onTouchMove)
      sheet.removeEventListener('touchend', end)
      sheet.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', end)
    }
  }, [ref])
}

type SheetProps = {
  label: string
  onClose: () => void
  children: ReactNode
  /** content pinned to the bottom of the sheet (the bill sheet's main action) */
  pinned?: ReactNode
  /** stack above another open sheet */
  stacked?: boolean
}

/** Bottom sheet: closes by tapping outside or swiping down. No Close buttons (v5). */
export function Sheet({ label, onClose, children, pinned, stacked }: SheetProps) {
  const ref = useDialogFocus(onClose)
  useSwipeToClose(ref, onClose)
  return (
    <div className={`psheet ${stacked ? 'top' : ''}`} onClick={onClose}>
      <div
        ref={ref}
        className={`pp ${pinned ? 'has-pin' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gr" aria-hidden="true" />
        {children}
        {pinned && <div className="pinned">{pinned}</div>}
      </div>
    </div>
  )
}

/** Centered pop-up for confirmations ("Is it really done?", "Leave household?"). */
export function Dialog({ label, onClose, children, alert = false, className = '' }: SheetProps & { alert?: boolean; className?: string }) {
  const ref = useDialogFocus(onClose)
  return (
    <div className="psheet mid" onClick={onClose}>
      <div
        ref={ref}
        className={`pop ${className}`}
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

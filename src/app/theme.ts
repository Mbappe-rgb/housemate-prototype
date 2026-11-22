import { useEffect } from 'react'

/** v5 themes. Forest is the default. */
export const THEMES = [
  ['forest', 'Forest'],
  ['night', 'Night'],
  ['lilac', 'Lilac'],
] as const

export type Theme = (typeof THEMES)[number][0]

/** Older saved names map onto the v5 themes. */
const LEGACY: Record<string, Theme> = { lime: 'forest', sage: 'forest', midnight: 'night', pop: 'lilac' }

export function normalizeTheme(theme: string | null | undefined): Theme {
  if (THEMES.some(([t]) => t === theme)) return theme as Theme
  return (theme && LEGACY[theme]) || 'forest'
}

/** Apply a theme to the page (sets <html data-theme>) and the browser's address-bar colour. */
export function useTheme(theme: string | null | undefined) {
  useEffect(() => {
    const t = normalizeTheme(theme)
    document.documentElement.dataset.theme = t
    const color = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color || '#F4F4F1')
  }, [theme])
}

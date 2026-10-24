import { useEffect } from 'react'

export const THEMES = [
  ['lime', 'Lime'],
  ['sage', 'Sage'],
  ['midnight', 'Midnight'],
  ['pop', 'Pop'],
] as const

export type Theme = (typeof THEMES)[number][0]

/** Apply a theme to the page (sets <html data-theme>). */
export function useTheme(theme: string | null | undefined) {
  useEffect(() => {
    const valid = THEMES.some(([t]) => t === theme) ? (theme as Theme) : 'lime'
    document.documentElement.dataset.theme = valid
    const color = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color || '#F4F4F2')
  }, [theme])
}

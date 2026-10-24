// Line icons from the prototype (24x24, stroke-based).
const PATHS = {
  home: 'M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z',
  bills: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  chores: 'M12 21a9 9 0 100-18 9 9 0 000 18zM8 12l3 3 5-6',
  plus: 'M12 5v14M5 12h14',
  bell: 'M6 16V11a6 6 0 1112 0v5l2 2H4zM10 21h4',
  check: 'M5 12l5 5 9-10',
  settings: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6',
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  profile: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  pen: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

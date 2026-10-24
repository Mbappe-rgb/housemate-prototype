type SegmentedProps<T extends string> = {
  label: string
  options: readonly (readonly [T, string])[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/** Pill-shaped switch between a few options (All / To pay / Done). */
export function Segmented<T extends string>({ label, options, value, onChange, className }: SegmentedProps<T>) {
  return (
    <div className={`seg2 ${className ?? ''}`} role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}>
          {text}
        </button>
      ))}
    </div>
  )
}

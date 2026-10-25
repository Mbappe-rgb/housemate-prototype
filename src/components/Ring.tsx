/** Progress ring used by the "At a glance" widgets. */
export function Ring({ fraction, color, label }: { fraction: number; color: string; label: string }) {
  const length = 2 * Math.PI * 26
  const f = Math.max(0, Math.min(1, fraction))
  return (
    <div className="rg">
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
        <circle cx="32" cy="32" r="26" fill="none" stroke="var(--track)" strokeWidth="8" />
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - f)}
          transform="rotate(-90 32 32)"
          style={{ transition: 'stroke-dashoffset .5s' }}
        />
      </svg>
      <b>{label}</b>
    </div>
  )
}

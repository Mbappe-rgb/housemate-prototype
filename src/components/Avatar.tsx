import { Icon } from './Icon'

type AvatarProps = { name: string; hue: number; size: number }

const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase()
const colours = (hue: number) => ({ background: `hsl(${hue} 70% 90%)`, color: `hsl(${hue} 45% 32%)` })

/** Pastel circle with the person's initial (v5 style guide). */
export function Avatar({ name, hue, size }: AvatarProps) {
  return (
    <span className="av" aria-hidden="true" style={{ width: size, height: size, fontSize: Math.round(size * 0.36), ...colours(hue) }}>
      {initial(name)}
    </span>
  )
}

export type TileStatus = 'paid' | 'sent' | 'unpaid' | 'payer-paid' | 'payer-unpaid'

/**
 * Small avatar with a status badge at the bottom right, for bill cards and payment progress:
 * green check = settled, amber clock = sent (waiting), black receipt = the payer.
 */
export function StatusTile({ name, hue, status, size = 'sm', label }: { name: string; hue: number; status: TileStatus; size?: 'sm' | 'md'; label: string }) {
  const badge =
    status === 'paid' ? (
      <span className="pb g">
        <Icon name="check" size={9} />
      </span>
    ) : status === 'sent' ? (
      <span className="pb a">
        <Icon name="clock" size={9} />
      </span>
    ) : status === 'payer-paid' ? (
      <span className="pb g">
        <Icon name="receipt" size={9} />
      </span>
    ) : status === 'payer-unpaid' ? (
      <span className="pb k">
        <Icon name="receipt" size={9} />
      </span>
    ) : null
  return (
    <span className={`pt ${size === 'md' ? 'md' : ''} ${status === 'unpaid' ? 'pend' : ''}`} style={colours(hue)} title={label} aria-label={label} role="img">
      {initial(name)}
      {badge}
    </span>
  )
}

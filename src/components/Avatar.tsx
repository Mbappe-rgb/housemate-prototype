type AvatarProps = { name: string; hue: number; size: number }

/** Coloured circle with the first letter of the name. */
export function Avatar({ name, hue, size }: AvatarProps) {
  return (
    <span
      className="av"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${hue} 62% 62%)` }}
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}

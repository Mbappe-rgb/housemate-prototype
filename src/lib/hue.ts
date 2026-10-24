/** Stable hue from a name, used for people who don't have one saved yet. */
export function hueFromName(name: string): number {
  return ((name.charCodeAt(0) || 0) * 47) % 360
}

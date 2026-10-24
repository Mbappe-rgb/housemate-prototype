/** Copy text and confirm with a toast. */
export function copyText(text: string, toast: (m: string) => void, what = text) {
  if (!navigator.clipboard) {
    toast('Couldn’t copy. Press and hold to copy instead.')
    return
  }
  navigator.clipboard.writeText(text).then(
    () => toast(`Copied ${what}`),
    () => toast('Couldn’t copy. Press and hold to copy instead.'),
  )
}

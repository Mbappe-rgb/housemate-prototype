// Reads the JSON that `supabase db query` prints for supabase/tests/isolation.sql
// and shows failures plus the "== x/y passed ==" line. Exits with 1 if anything failed.
let raw = ''
process.stdin.on('data', (chunk) => (raw += chunk))
process.stdin.on('end', () => {
  const start = raw.indexOf('{')
  let rows
  try {
    rows = JSON.parse(raw.slice(start)).rows
  } catch {
    console.error(raw.slice(-3000))
    process.exit(1)
  }
  if (!Array.isArray(rows)) {
    console.error(raw.slice(-3000))
    process.exit(1)
  }
  let failed = 0
  for (const r of rows) {
    if (r.result === 'PASS') continue
    if (r.result === 'FAIL') failed++
    console.log(`${r.result.padEnd(5)} ${r.check_name.padEnd(60)} ${String(r.detail).slice(0, 200)}`)
  }
  process.exit(failed ? 1 : 0)
})

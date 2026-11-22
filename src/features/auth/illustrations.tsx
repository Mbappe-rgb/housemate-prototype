// Flat illustrations from the v5 prototype (style guide: peach, orange, mauve and pale shapes with a thin
// offset outline, no gradients). Fixed shapes only, no user data.
const PL = { a: '#F3D5BD', b: '#E5995B', c: '#BE9F9F', d: '#E8DEDE', ink: '#1b1b1b' }

/** A gear outline: n teeth around (cx, cy), with a round hole. */
function gearPath(cx: number, cy: number, R: number, n: number, hole = 0.38): string {
  const r = R * 0.8
  const pts: string[] = []
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 6.2832
    const w = 6.2832 / n
    for (const [t, rr] of [
      [0, r],
      [0.18, R],
      [0.5, R],
      [0.68, r],
    ]) {
      const a = a0 + t * w
      pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`)
    }
  }
  const h = R * hole
  return `M${pts.join('L')}Z M${cx + h},${cy}a${h},${h} 0 1,0 ${-2 * h},0a${h},${h} 0 1,0 ${2 * h},0Z`
}

const Gear = ({ cx, cy, R, n, fill, hole }: { cx: number; cy: number; R: number; n: number; fill: string; hole?: number }) => (
  <path fillRule="evenodd" fill={fill} d={gearPath(cx, cy, R, n, hole)} />
)
const Bar = ({ x, y, w, c = '#e3e1de' }: { x: number; y: number; w: number; c?: string }) => <rect x={x} y={y} width={w} height={7} rx={3.5} fill={c} />
const Tick = ({ d, w = 2 }: { d: string; w?: number }) => <path d={d} fill="none" stroke="#fff" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="ilp">
      <svg viewBox="0 0 300 240" width="100%" aria-hidden="true">
        {children}
      </svg>
    </div>
  )
}

/** 1: See what you owe at a glance */
export function OweIllustration() {
  return (
    <Panel>
      <Gear cx={238} cy={58} R={28} n={9} fill={PL.a} />
      <Gear cx={60} cy={196} R={22} n={8} fill={PL.d} />
      <circle cx={104} cy={112} r={62} fill={PL.a} />
      <path d="M104 50a62 62 0 1 1-52 96" fill="none" stroke={PL.b} strokeWidth={16} strokeLinecap="round" />
      <circle cx={104} cy={112} r={38} fill="#fff" />
      <text x={104} y={124} textAnchor="middle" fontSize={34} fontWeight={700} fill={PL.ink} fontFamily="Inter,system-ui">
        $
      </text>
      <path d="M60 188c18 12 46 14 70 4" fill="none" stroke={PL.ink} strokeWidth={2} strokeLinecap="round" />
      <g transform="translate(166 96)">
        <rect x={6} y={6} width={116} height={52} rx={14} fill="none" stroke={PL.ink} strokeWidth={2} />
        <rect width={116} height={52} rx={14} fill="#fff" />
        <rect x={10} y={12} width={28} height={28} rx={9} fill={PL.b} />
        <Bar x={46} y={15} w={52} />
        <Bar x={46} y={29} w={36} />
      </g>
      <g transform="translate(150 150)">
        <rect width={116} height={52} rx={14} fill="#fff" />
        <rect x={10} y={12} width={28} height={28} rx={9} fill={PL.c} />
        <Bar x={46} y={15} w={44} />
        <Bar x={46} y={29} w={60} />
        <circle cx={100} cy={26} r={9} fill="var(--acc)" />
        <Tick d="m96 26 3 3 5-6" />
      </g>
    </Panel>
  )
}

/** 2: Split fairly, pay with proof */
export function SplitIllustration() {
  const zig = 'v128l-12-9-12 9-12-9-12 9-12-9-12 9-12-9-12 9z'
  return (
    <Panel>
      <Gear cx={250} cy={190} R={22} n={8} fill={PL.c} />
      <Gear cx={46} cy={52} R={18} n={8} fill={PL.a} />
      <g transform="translate(54 62)">
        <path d={`M6 6h96${zig}`} fill="none" stroke={PL.ink} strokeWidth={2} />
        <path d={`M0 0h96${zig}`} fill="#fff" />
        <Bar x={14} y={16} w={40} />
        <Bar x={14} y={32} w={68} c={PL.d} />
        <Bar x={14} y={48} w={56} c={PL.d} />
        <Bar x={14} y={72} w={68} c={PL.d} />
        <Bar x={14} y={88} w={30} c={PL.d} />
        <circle cx={72} cy={108} r={11} fill="var(--acc)" />
        <Tick d="m67 108 4 4 7-8" w={2.4} />
      </g>
      <g transform="translate(222 108)">
        <circle r={54} fill={PL.a} />
        <path d="M0 0V-54A54 54 0 0 1 54 0Z" fill={PL.b} />
        <path d="M0 0H54A54 54 0 0 1 0 54Z" fill={PL.c} />
        <path d="M0 0V54A54 54 0 0 1 -54 0Z" fill={PL.d} />
        <circle r={17} fill="#fff" />
      </g>
      <circle cx={222} cy={108} r={54} fill="none" stroke={PL.ink} strokeWidth={2} strokeDasharray="2 8" opacity={0.35} />
    </Panel>
  )
}

/** 3: Chores without the nagging */
export function ChoresIllustration() {
  return (
    <Panel>
      <Gear cx={40} cy={48} R={20} n={8} fill={PL.d} />
      <Gear cx={262} cy={60} R={26} n={9} fill={PL.a} />
      <g transform="translate(34 56)">
        <rect x={6} y={6} width={232} height={52} rx={16} fill="none" stroke={PL.ink} strokeWidth={2} />
        <rect width={232} height={52} rx={16} fill="#fff" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <circle key={i} cx={22 + i * 31} cy={26} r={i === 3 ? 13 : 9} fill={i === 3 ? PL.b : PL.d} />
        ))}
      </g>
      <g transform="translate(34 126)">
        {(
          [
            [0, true],
            [1, true],
            [2, false],
          ] as [number, boolean][]
        ).map(([i, done]) => (
          <g key={i} transform={`translate(0 ${i * 34})`}>
            <rect width={196} height={28} rx={14} fill="#fff" />
            <circle cx={16} cy={14} r={8} fill={done ? 'var(--acc)' : 'none'} stroke={done ? 'none' : PL.c} strokeWidth={2} />
            {done && <Tick d="m12 14 3 3 5-6" />}
            <Bar x={34} y={10} w={done ? 96 : 120} c={done ? PL.a : PL.d} />
          </g>
        ))}
      </g>
      <g transform="translate(246 190)">
        <path d="M0 0c-4-26 8-44 22-58" fill="none" stroke={PL.ink} strokeWidth={2} strokeLinecap="round" />
        <path d="M-6 6h30l-6-18h-18z" fill={PL.c} />
        <path d="M22-58c-16 2-26 12-22 26 14-2 24-10 22-26z" fill="var(--acc)" />
      </g>
    </Panel>
  )
}

/** Privacy page: shield with a tick among gears. */
export function PrivacyIllustration() {
  const shield = 'M150 40 226 62v62c0 40-30 68-76 88-46-20-76-48-76-88V62z'
  return (
    <svg viewBox="0 0 300 250" width="100%" aria-hidden="true">
      <Gear cx={92} cy={104} R={50} n={10} fill="#E5995B" hole={0.3} />
      <Gear cx={236} cy={84} R={34} n={9} fill="#E8DEDE" hole={0.3} />
      <Gear cx={60} cy={196} R={26} n={8} fill="#BE9F9F" hole={0.4} />
      <Gear cx={232} cy={184} R={28} n={8} fill="#F3D5BD" hole={0.4} />
      <Gear cx={168} cy={26} R={22} n={8} fill="#F3D5BD" />
      <path d={shield} fill="none" stroke="#1b1b1b" strokeWidth={2} transform="translate(6 6)" />
      <path d={shield} fill="var(--acc)" />
      <path d="m118 124 24 24 42-48" fill="none" stroke="#fff" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

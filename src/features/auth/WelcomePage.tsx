import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useTheme } from '../../app/theme'
import { ChoresIllustration, OweIllustration, SplitIllustration } from './illustrations'

const SLIDES = [
  { title: 'See what you owe at a glance', text: 'One balance and one list. Know what’s due this week without asking around.', Art: OweIllustration },
  { title: 'Split fairly, pay with proof', text: 'Share a bill evenly or your way. Attach a receipt so everyone sees who has paid.', Art: SplitIllustration },
  { title: 'Chores without the nagging', text: 'Share the load, tick it off, and keep the peace at home.', Art: ChoresIllustration },
]
const AUTO_MS = 4800

/** Intro (v5): three slides that auto-advance and loop; Log in and Sign up on every slide. */
export function WelcomePage() {
  useTheme('forest')
  const [i, setI] = useState(0)
  const lastTap = useRef(0)
  const startX = useRef<number | null>(null)

  const go = useCallback((n: number) => {
    lastTap.current = Date.now()
    setI(((n % SLIDES.length) + SLIDES.length) % SLIDES.length)
  }, [])

  // Auto-advance; a manual change resets the timer. Paused when the user prefers less motion.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => {
      if (Date.now() - lastTap.current >= AUTO_MS) setI((x) => (x + 1) % SLIDES.length)
    }, 600)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(i + 1)
      if (e.key === 'ArrowLeft') go(i - 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [i, go])

  return (
    <main
      className="intro"
      onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (startX.current === null) return
        const dx = e.changedTouches[0].clientX - startX.current
        startX.current = null
        if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1))
      }}
    >
      <div className="flow" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="iview" aria-hidden="true">
        <div className="itrack" style={{ transform: `translateX(-${i * 100}%)` }}>
          {SLIDES.map(({ title, Art }) => (
            <div key={title} className="islide">
              <Art />
            </div>
          ))}
        </div>
      </div>
      <div className="idots" role="tablist" aria-label="Slides">
        {SLIDES.map((s, n) => (
          <button key={s.title} type="button" role="tab" aria-selected={n === i} aria-current={n === i} aria-label={`Slide ${n + 1}`} onClick={() => go(n)} />
        ))}
      </div>
      <div className="isheet">
        <div className="itxs" aria-live="polite">
          {SLIDES.map((s, n) => (
            <div key={s.title} className={`itx ${n === i ? 'on' : ''}`} aria-hidden={n !== i}>
              <h1>{s.title}</h1>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
        <div className="iauth">
          <Link to="/login" className="btn">
            Log in
          </Link>
          <Link to="/privacy" className="btn out">
            Sign up
          </Link>
        </div>
      </div>
    </main>
  )
}

import type { ReactNode } from 'react'

/** Shared frame for the logged-out and setup screens. Phase 1 restyles these to match the prototype. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="page auth">
      <header className="auth-head">
        <p className="brand">HouseMate</p>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </header>
      {children}
    </main>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="err" role="alert">
      {message}
    </p>
  )
}

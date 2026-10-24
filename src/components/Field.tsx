import { useId, type InputHTMLAttributes } from 'react'

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
}

/** Labelled text input. Font size stays at 16px+ so iOS doesn't zoom in. */
export function Field({ label, hint, ...input }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className="field">
      <label htmlFor={id} className="lbl">
        {label}
      </label>
      <input id={id} className="fld" aria-describedby={hintId} {...input} />
      {hint && (
        <small id={hintId} className="muted hint">
          {hint}
        </small>
      )}
    </div>
  )
}

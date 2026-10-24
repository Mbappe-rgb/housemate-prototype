import { useState, type InputHTMLAttributes } from 'react'

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  /** read by screen readers; the placeholder is what people see (prototype style) */
  label: string
}

/** Text input styled like the prototype. Text stays 16px+ so iOS doesn't zoom in. */
export function Field({ label, className, ...input }: FieldProps) {
  return <input aria-label={label} className={`fld ${className ?? ''}`} {...input} />
}

/** Password input with a Show/Hide button. */
export function PasswordField({ label, ...input }: FieldProps) {
  const [shown, setShown] = useState(false)
  return (
    <div className="pw">
      <input aria-label={label} className="fld" type={shown ? 'text' : 'password'} {...input} />
      <button type="button" className="eye" onClick={() => setShown(!shown)} aria-label={shown ? 'Hide password' : 'Show password'}>
        {shown ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}

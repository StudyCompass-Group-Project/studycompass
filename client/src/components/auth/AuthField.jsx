import { useState } from 'react'
import AuthIcon from './AuthIcon.jsx'

export default function AuthField({
  id, name, label, type = 'text', icon, value, onChange, autoComplete,
  placeholder, error, hint, action, describedBy,
}) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const description = [hint && `${id}-hint`, error && `${id}-error`, describedBy]
    .filter(Boolean).join(' ') || undefined

  return (
    <div className="sc-auth-field">
      <div className="sc-auth-label-row">
        <label htmlFor={id}>{label}</label>
        {action}
      </div>
      <div className={`sc-auth-input-wrap${icon ? ' sc-auth-with-icon' : ''}`}>
        {icon && <span className="sc-auth-input-icon"><AuthIcon name={icon} size={18} /></span>}
        <input
          id={id} name={name} type={isPassword && showPassword ? 'text' : type}
          value={value} onChange={onChange} autoComplete={autoComplete}
          placeholder={placeholder} required spellCheck={false} autoCapitalize="none"
          aria-invalid={error ? true : undefined} aria-describedby={description}
          className={isPassword ? 'sc-auth-password-input' : undefined}
        />
        {isPassword && (
          <button className="sc-auth-visibility" type="button"
            aria-label={`${showPassword ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
            aria-pressed={showPassword} aria-controls={id}
            onClick={() => setShowPassword(!showPassword)}>
            <AuthIcon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
          </button>
        )}
      </div>
      {hint && <p className="sc-auth-hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="sc-auth-error" id={`${id}-error`}>{error}</p>}
    </div>
  )
}

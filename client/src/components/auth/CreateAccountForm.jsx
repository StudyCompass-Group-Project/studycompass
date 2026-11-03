import { useState } from 'react'
import { getPasswordRequirements, validateCreateAccount } from '../../utils/auth.js'
import AuthField from './AuthField.jsx'
import AuthIcon from './AuthIcon.jsx'

export default function CreateAccountForm() {
  const [values, setValues] = useState({
    email: '', username: '', password: '', confirmPassword: '', permission: false,
  })
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState('')
  const errors = submitted ? validateCreateAccount(values) : {}
  const requirements = getPasswordRequirements(values.password)
  const completed = requirements.filter(rule => rule.met).length

  function handleChange(event) {
    const { name, value, type, checked } = event.target
    setValues(current => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    setMessage('')
  }

  function handleSubmit(event) {
    event.preventDefault()
    setSubmitted(true)
    const firstError = Object.keys(validateCreateAccount(values))[0]
    if (firstError) {
      event.currentTarget.elements.namedItem(firstError)?.focus()
      return
    }
    // Account creation will need server-side validation and a real auth provider.
    setMessage('The form is ready. Registration is not available yet; no account was created and nothing was sent or saved.')
  }

  return (
    <form className="sc-auth-form" noValidate onSubmit={handleSubmit} aria-label="Create account"
      aria-describedby="sc-auth-preview-note">
      <AuthField id="signup-email" name="email" label="Institutional or Personal Email"
        type="email" icon="email" value={values.email} onChange={handleChange}
        autoComplete="email" placeholder="name@university.edu" error={errors.email} />
      <AuthField id="signup-username" name="username" label="Academic Username"
        icon="person" value={values.username} onChange={handleChange} autoComplete="username"
        placeholder="your_username" hint="3–30 letters, numbers, or underscores." error={errors.username} />
      <div className="sc-auth-password-grid">
        <AuthField id="signup-password" name="password" label="Password" type="password"
          value={values.password} onChange={handleChange} autoComplete="new-password"
          placeholder="Minimum 8 characters" error={errors.password} describedBy="sc-auth-password-rules" />
        <AuthField id="signup-confirm" name="confirmPassword" label="Confirm Password" type="password"
          value={values.confirmPassword} onChange={handleChange} autoComplete="new-password"
          placeholder="Repeat password" error={errors.confirmPassword} />
      </div>
      <div className="sc-auth-requirements" id="sc-auth-password-rules">
        <div className="sc-auth-requirements-heading">
          <span>Password requirements</span>
          <strong>{values.password ? `${completed} of 3 met` : 'Awaiting input'}</strong>
        </div>
        <div className="sc-auth-meter" aria-hidden="true">
          {requirements.map((rule, index) => <span key={rule.label} data-filled={index < completed} />)}
        </div>
        <ul>
          {requirements.map(rule => (
            <li key={rule.label} data-met={rule.met}>
              <span aria-hidden="true">{rule.met ? '✓' : '•'}</span>
              <span className="sc-auth-sr-only">{rule.met ? 'Met: ' : 'Not met: '}</span>
              {rule.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="sc-auth-permission">
        <label className="sc-auth-checkbox">
          <input type="checkbox" name="permission" checked={values.permission} onChange={handleChange}
            required aria-invalid={errors.permission ? true : undefined}
            aria-describedby={errors.permission ? 'signup-permission-error' : undefined} />
          <span>I have permission to upload and process my course syllabi.</span>
        </label>
        {errors.permission && <p className="sc-auth-error" id="signup-permission-error">{errors.permission}</p>}
        <p className="sc-auth-hint">Account terms will be available when registration opens.</p>
      </div>
      <button className="sc-auth-submit" type="submit">
        Create Account &amp; Start Planning <AuthIcon name="check" size={18} />
      </button>
      <div className="sc-auth-feedback" role="status" aria-atomic="true">
        {message && <p>{message}</p>}
      </div>
    </form>
  )
}

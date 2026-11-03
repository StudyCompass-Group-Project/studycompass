import { useState } from 'react'
import { validateSignIn } from '../../utils/auth.js'
import AuthField from './AuthField.jsx'
import AuthIcon from './AuthIcon.jsx'

export default function SignInForm({ onForgotPassword }) {
  const [values, setValues] = useState({ identity: '', password: '', remember: true })
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState('')
  const errors = submitted ? validateSignIn(values) : {}

  function handleChange(event) {
    const { name, value, type, checked } = event.target
    setValues(current => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    setMessage('')
  }

  function handleSubmit(event) {
    event.preventDefault()
    setSubmitted(true)
    const firstError = Object.keys(validateSignIn(values))[0]
    if (firstError) {
      event.currentTarget.elements.namedItem(firstError)?.focus()
      return
    }
    // Replace this preview response with the team's authentication service later.
    // Never treat valid form input as proof of a signed-in session.
    setMessage('The form is ready. Sign-in is not available yet; nothing was sent or saved.')
  }

  return (
    <form className="sc-auth-form" noValidate onSubmit={handleSubmit} aria-label="Sign in"
      aria-describedby="sc-auth-preview-note">
      <AuthField id="signin-identity" name="identity" label="Email or Academic Username"
        icon="school" value={values.identity} onChange={handleChange} autoComplete="username"
        placeholder="name@university.edu or @username" error={errors.identity} />
      <AuthField id="signin-password" name="password" label="Password" type="password"
        icon="lock" value={values.password} onChange={handleChange} autoComplete="current-password"
        placeholder="Enter your password" error={errors.password}
        action={<button type="button" className="sc-auth-text-button" onClick={onForgotPassword}>
          Forgot password?
        </button>} />
      <label className="sc-auth-checkbox">
        <input type="checkbox" name="remember" checked={values.remember} onChange={handleChange} />
        <span>Remember this workstation for 30 days</span>
      </label>
      <button className="sc-auth-submit" type="submit">
        Sign In to StudyCompass <AuthIcon name="arrow" size={18} />
      </button>
      <div className="sc-auth-feedback" role="status" aria-atomic="true">
        {message && <p>{message}</p>}
      </div>
    </form>
  )
}

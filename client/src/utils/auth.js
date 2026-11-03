// These are frontend checks for the Stitch prototype, not authentication.
// The eventual server must validate input and enforce its own password policy.
export function getPasswordRequirements(password) {
  return [
    { label: '8+ characters', met: [...password].length >= 8 },
    { label: '1+ number', met: /[0-9]/.test(password) },
    { label: '1+ symbol', met: /[\p{P}\p{S}]/u.test(password) },
  ]
}

export function validateSignIn({ identity = '', password = '' } = {}) {
  const errors = {}
  if (!identity.trim()) errors.identity = 'Enter your email or academic username.'
  // Do not apply new-account password rules to an existing account's password.
  if (!password) errors.password = 'Enter your password.'
  return errors
}

export function validateCreateAccount({
  email = '', username = '', password = '', confirmPassword = '', permission = false,
} = {}) {
  const errors = {}
  if (!email.trim()) errors.email = 'Enter your email address.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Enter a valid email address, such as name@university.edu.'
  }
  if (!username.trim()) errors.username = 'Choose an academic username.'
  else if (!/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) {
    errors.username = 'Use 3–30 letters, numbers, or underscores.'
  }
  if (!password) errors.password = 'Create a password.'
  else if (!getPasswordRequirements(password).every(rule => rule.met)) {
    errors.password = 'Use at least 8 characters, one number, and one symbol.'
  }
  if (!confirmPassword) errors.confirmPassword = 'Repeat your password.'
  else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.'
  if (!permission) errors.permission = 'Confirm you have permission to use your course syllabi.'
  return errors
}

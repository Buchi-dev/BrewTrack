export function getFriendlyAuthError(error, fallback = 'Unable to continue. Please try again.') {
  const message = error?.message ?? ''

  if (/invalid login|invalid.*credentials/i.test(message)) {
    return 'Incorrect email or password.'
  }

  if (/email not confirmed/i.test(message)) {
    return 'This email is not ready to sign in yet. Ask a manager to check the account setup.'
  }

  if (/rate limit|too many/i.test(message)) {
    return 'Too many attempts. Please wait a moment and try again.'
  }

  if (/failed to fetch|network|connection/i.test(message)) {
    return 'Unable to connect. Check your internet and try again.'
  }

  if (/not configured|supabase/i.test(message)) {
    return message
  }

  return fallback
}

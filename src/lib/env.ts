const trueValues = new Set(['1', 'true', 'yes', 'on'])

export function isTruthyEnv(value: string | undefined, fallback = false) {
  if (value == null) return fallback
  return trueValues.has(value.trim().toLowerCase())
}

export function getAllowedSignupEmails() {
  return (process.env.ALLOWED_SIGNUP_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function isSelfSignupEnabled() {
  return isTruthyEnv(
    process.env.ALLOW_SELF_SIGNUP ?? process.env.NEXT_PUBLIC_ALLOW_SELF_SIGNUP,
    true,
  )
}

export function isGoogleAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export function getGoogleSheetsOwnerEmail() {
  const value = process.env.GOOGLE_SHEETS_OWNER_EMAIL?.trim().toLowerCase()
  return value || null
}

export function getStorageType() {
  return process.env.STORAGE_TYPE === 's3' ? 's3' : 'local'
}

export function shouldProcessReceiptsInline() {
  return isTruthyEnv(process.env.OCR_INLINE_FALLBACK, process.env.NODE_ENV !== 'production')
}

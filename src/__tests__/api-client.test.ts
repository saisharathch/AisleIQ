import { getFriendlyErrorMessage } from '@/lib/api-client'

describe('getFriendlyErrorMessage', () => {
  it('maps expired Google token errors to a friendlier message', () => {
    expect(getFriendlyErrorMessage({ code: 'GOOGLE_AUTH_EXPIRED', error: 'raw' })).toContain('Google session expired')
  })

  it('falls back to the server message for unknown codes', () => {
    expect(getFriendlyErrorMessage({ code: 'SOMETHING_NEW', error: 'Server message' })).toBe('Server message')
  })
})

import type { ApiError } from '@/types'

export async function readApiError(
  res: Response,
  fallback = 'Something went wrong. Please try again.',
): Promise<ApiError> {
  try {
    const payload = (await res.json()) as Partial<ApiError>

    return {
      ok: false,
      code: payload.code ?? 'UNKNOWN_ERROR',
      error: payload.error ?? fallback,
      details: Array.isArray(payload.details) ? payload.details : undefined,
    }
  } catch {
    return {
      ok: false,
      code: 'UNKNOWN_ERROR',
      error: fallback,
    }
  }
}

export function getFriendlyErrorMessage(error: Pick<ApiError, 'code' | 'error'>) {
  const commonMessages: Record<string, string> = {
    DUPLICATE_UPLOAD: 'This receipt is already uploading. Wait a moment before trying again.',
    GOOGLE_AUTH_EXPIRED: 'Your Google session expired. Sign in with Google again, then retry the sync.',
    SHEETS_SCOPE_MISSING: 'Google Sheets permission is missing. Reconnect Google and allow Sheets access.',
    RECEIPT_ITEMS_MISSING: 'This receipt does not have any items yet. Add at least one item before syncing.',
    INVALID_RECEIPT_DATA: 'This receipt still has invalid or incomplete item data. Fix the highlighted rows and try again.',
    PERMISSION_DENIED: 'Google blocked Sheets access for this account. Check your Google permissions and try again.',
    INVALID_RETRY_ACTION: 'That retry request was invalid. Please reload the page and try again.',
  }

  return commonMessages[error.code] ?? error.error
}

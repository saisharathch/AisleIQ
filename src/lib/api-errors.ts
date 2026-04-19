import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import type { ApiError } from '@/types'

type ErrorDetail = ApiError['details']

export function errorResponse(
  status: number,
  code: string,
  error: string,
  details?: ErrorDetail,
) {
  return NextResponse.json<ApiError>(
    {
      ok: false,
      code,
      error,
      ...(details ? { details } : {}),
    },
    { status },
  )
}

export function validationErrorResponse(error: ZodError, message = 'Invalid request data.') {
  return errorResponse(
    400,
    'VALIDATION_ERROR',
    message,
    error.issues.map((issue) => ({
      field: issue.path.join('.') || undefined,
      message: issue.message,
    })),
  )
}

export async function readJsonBody(req: Request): Promise<unknown> {
  const text = await req.text()
  if (!text.trim()) return {}

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw errorResponse(400, 'INVALID_JSON', 'Request body must be valid JSON.')
  }
}

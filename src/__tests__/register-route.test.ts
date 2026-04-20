/** @jest-environment node */

import { NextRequest } from 'next/server'
import { POST as registerUser } from '@/app/api/auth/register/route'
import { db } from '@/lib/db'

jest.mock('bcryptjs', () => ({
  hash: jest.fn(async () => 'hashed-password'),
}))

jest.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}))

const mockedDb = db as unknown as {
  user: {
    findUnique: jest.Mock
    create: jest.Mock
  }
}

async function readJson(res: Response) {
  return res.json()
}

describe('register route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedDb.user.findUnique.mockResolvedValue(null)
    mockedDb.user.create.mockResolvedValue({ id: 'user-1' })
    delete process.env.ALLOW_SELF_SIGNUP
    delete process.env.NEXT_PUBLIC_ALLOW_SELF_SIGNUP
    delete process.env.ALLOWED_SIGNUP_EMAILS
  })

  it('rejects sign-up when self-service access is disabled', async () => {
    process.env.ALLOW_SELF_SIGNUP = 'false'

    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Beta User',
        email: 'beta@example.com',
        password: 'Password1',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await registerUser(req)
    const body = await readJson(res)

    expect(res.status).toBe(403)
    expect(body.error).toContain('disabled')
  })

  it('rejects emails outside the beta allowlist', async () => {
    process.env.ALLOW_SELF_SIGNUP = 'true'
    process.env.ALLOWED_SIGNUP_EMAILS = 'owner@example.com,roommate@example.com'

    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Beta User',
        email: 'outsider@example.com',
        password: 'Password1',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await registerUser(req)
    const body = await readJson(res)

    expect(res.status).toBe(403)
    expect(body.error).toContain('not allowed')
    expect(mockedDb.user.create).not.toHaveBeenCalled()
  })

  it('creates an allowed user with a normalized email address', async () => {
    process.env.ALLOW_SELF_SIGNUP = 'true'
    process.env.ALLOWED_SIGNUP_EMAILS = 'owner@example.com'

    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Owner',
        email: 'OWNER@EXAMPLE.COM',
        password: 'Password1',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await registerUser(req)

    expect(res.status).toBe(201)
    expect(mockedDb.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'owner@example.com' },
    })
    expect(mockedDb.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'owner@example.com',
      }),
    })
  })
})

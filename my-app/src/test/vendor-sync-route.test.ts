import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getUserMock = vi.fn()
const profileSingleMock = vi.fn()
const upsertVendorForTechnicianMock = vi.fn()

vi.mock('@/lib/bill/vendor', () => ({
  upsertVendorForTechnician: (...args: unknown[]) => upsertVendorForTechnicianMock(...args),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn((_: string, key: string) => {
    // Anon client path (auth.getUser)
    if (key === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return {
        auth: {
          getUser: (...args: unknown[]) => getUserMock(...args),
        },
      }
    }

    // Service-role path (profiles role lookup)
    return {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: (...args: unknown[]) => profileSingleMock(...args),
          })),
        })),
      })),
    }
  }),
}))

const { POST } = await import('@/api/bill/vendors/sync/route')

describe('POST /api/bill/vendors/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  })

  it('returns 401 when authorization header is missing', async () => {
    const request = new NextRequest('http://localhost/api/bill/vendors/sync', {
      method: 'POST',
      body: JSON.stringify({ technicianId: 'tech-1' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.ok).toBe(false)
  })

  it('returns 400 when technicianId is missing', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null,
    })

    const request = new NextRequest('http://localhost/api/bill/vendors/sync', {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify({}),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('returns 403 when caller is not admin or self technician', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'lab-1' } },
      error: null,
    })

    profileSingleMock.mockResolvedValue({
      data: { id: 'lab-1', role: 'lab' },
      error: null,
    })

    const request = new NextRequest('http://localhost/api/bill/vendors/sync', {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify({ technicianId: 'tech-1' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(403)
  })

  it('returns 200 and sync result when admin triggers sync', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null,
    })

    profileSingleMock.mockResolvedValue({
      data: { id: 'admin-1', role: 'admin' },
      error: null,
    })

    upsertVendorForTechnicianMock.mockResolvedValue({
      ok: true,
      code: 'synced',
      action: 'created',
      technicianId: 'tech-1',
      billVendorId: 'V-100',
      vendorStatus: 'synced',
      vendorLastSyncedAt: new Date().toISOString(),
    })

    const request = new NextRequest('http://localhost/api/bill/vendors/sync', {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify({ technicianId: 'tech-1' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.technicianId).toBe('tech-1')
  })

  it('maps validation errors to 400', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null,
    })

    profileSingleMock.mockResolvedValue({
      data: { id: 'admin-1', role: 'admin' },
      error: null,
    })

    upsertVendorForTechnicianMock.mockResolvedValue({
      ok: false,
      code: 'validation_error',
      technicianId: 'tech-1',
      message: 'Missing required vendor fields: city',
      missingFields: ['city'],
    })

    const request = new NextRequest('http://localhost/api/bill/vendors/sync', {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify({ technicianId: 'tech-1' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
  })
})

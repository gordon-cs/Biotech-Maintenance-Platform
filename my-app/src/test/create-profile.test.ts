import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockServiceClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockServiceClient),
}))

const { POST } = await import('@/api/create-profile/route')

describe('Create Profile API', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns 401 when authorization header is missing', async () => {
    const request = new NextRequest('http://localhost/api/create-profile', {
      method: 'POST',
      body: JSON.stringify({ role: 'lab' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Missing token')
  })

  it('creates lab profile and default address', async () => {
    mockServiceClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'lab@example.com' } },
      error: null,
    })

    mockServiceClient.from
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })
      .mockReturnValueOnce({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      })
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })
      .mockReturnValueOnce({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { id: 44 }, error: null }),
          })),
        })),
      })
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        })),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      })

    const request = new NextRequest('http://localhost/api/create-profile', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
      },
      body: JSON.stringify({
        role: 'lab',
        full_name: 'Lab Owner',
        lab: { name: 'Bio Lab' },
        address: {
          line1: '1 Main St',
          city: 'Boston',
          state: 'MA',
          zipcode: '02110',
        },
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
  })

  it('upserts technician profile details', async () => {
    mockServiceClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'tech-1', email: 'tech@example.com' } },
      error: null,
    })

    mockServiceClient.from
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })
      .mockReturnValueOnce({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      })
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { id: 'tech-1' }, error: null }),
          })),
        })),
      })
      .mockReturnValueOnce({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      })

    const request = new NextRequest('http://localhost/api/create-profile', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
      },
      body: JSON.stringify({
        role: 'technician',
        full_name: 'Tech User',
        tech: {
          experience: '5 years',
          bio: 'Field engineer',
          company: 'BioFix',
        },
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
  })
})

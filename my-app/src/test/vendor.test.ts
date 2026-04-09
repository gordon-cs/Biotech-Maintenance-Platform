import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSupabase = {
  from: vi.fn(),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/bill/client', () => ({
  billClient: {
    createVendor: vi.fn(),
    updateVendor: vi.fn(),
    createVendorBill: vi.fn(),
  },
}))

const { buildVendorPayload } = await import('@/lib/bill/vendor')

describe('vendor.ts - buildVendorPayload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds payload with profile full_name', () => {
    const result = buildVendorPayload(
      {
        full_name: 'Jane Tech',
        email: 'jane@example.com',
        phone: '6175551111',
      },
      {
        company: 'BioFix Co',
        line1: '1 Main St',
        line2: 'Suite 2',
        city: 'Boston',
        state: 'MA',
        zipcode: '02110',
      }
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.payload.name).toBe('Jane Tech')
    expect(result.payload.email).toBe('jane@example.com')
    expect(result.payload.companyName).toBe('BioFix Co')
    expect(result.payload.address1).toBe('1 Main St')
    expect(result.payload.city).toBe('Boston')
  })

  it('falls back to company name when full_name is missing', () => {
    const result = buildVendorPayload(
      {
        full_name: null,
        email: 'ops@biofix.com',
        phone: null,
      },
      {
        company: 'BioFix Services',
        line1: '77 Broadway',
        line2: null,
        city: 'Cambridge',
        state: 'MA',
        zipcode: '02139',
      }
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.payload.name).toBe('BioFix Services')
  })

  it('returns validation error with missing fields', () => {
    const result = buildVendorPayload(
      {
        full_name: '',
        email: '',
        phone: null,
      },
      {
        company: '',
        line1: '',
        line2: null,
        city: '',
        state: '',
        zipcode: '',
      }
    )

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.code).toBe('validation_error')
    expect(result.missingFields).toContain('full_name')
    expect(result.missingFields).toContain('email')
    expect(result.missingFields).toContain('line1')
    expect(result.missingFields).toContain('city')
    expect(result.missingFields).toContain('state')
    expect(result.missingFields).toContain('zipcode')
  })
})

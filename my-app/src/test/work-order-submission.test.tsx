import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WorkOrderSubmission from '@/components/WorkOrderSubmission'

const pushMock = vi.fn()
const getUserMock = vi.fn()
const fromMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => ({ get: () => null }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args),
    },
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

describe('WorkOrderSubmission', () => {
  let insertedPayload: Record<string, unknown> | null

  beforeEach(() => {
    vi.clearAllMocks()
    insertedPayload = null

    getUserMock.mockResolvedValue({
      data: { user: { id: 'manager-1' } },
      error: null,
    })

    fromMock.mockImplementation((table: string) => {
      if (table === 'categories') {
        return {
          select: vi.fn((columns: string) => {
            if (columns === 'id,slug,name') {
              return Promise.resolve({
                data: [{ id: 2, slug: 'equipment', name: 'Equipment' }],
                error: null,
              })
            }

            return {
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 2 }, error: null }),
              })),
            }
          }),
        }
      }

      if (table === 'labs') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 7, manager_id: 'manager-1' },
                error: null,
              }),
            })),
          })),
        }
      }

      if (table === 'addresses') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 12,
                  line1: '1 Main St',
                  line2: null,
                  city: 'Boston',
                  state: 'MA',
                  zipcode: '02110',
                },
              ],
              error: null,
            }),
          })),
        }
      }

      if (table === 'work_orders') {
        return {
          insert: vi.fn((payload: unknown) => {
            insertedPayload = payload as Record<string, unknown>
            return {
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: '99', payload },
                  error: null,
                }),
              })),
            }
          }),
        }
      }

      return {}
    })
  })

  it('redirects to manage-addresses when add_new address is selected', async () => {
    render(<WorkOrderSubmission />)

    const addressSelect = await screen.findByRole('combobox', { name: /service area \(address\) \*/i })
    fireEvent.change(addressSelect, { target: { name: 'address_id', value: 'add_new' } })

    expect(pushMock).toHaveBeenCalledWith(expect.stringMatching(/^\/manage-addresses\?/))
  })

  it('submits a work order and resolves category slug to category id', async () => {
    render(<WorkOrderSubmission />)

    fireEvent.change(await screen.findByRole('textbox', { name: /title \*/i }), {
      target: { name: 'title', value: 'Fix incubator alarm' },
    })

    fireEvent.change(screen.getByRole('textbox', { name: /description \*/i }), {
      target: { name: 'description', value: 'Incubator alarm keeps triggering after restart.' },
    })

    fireEvent.change(screen.getByRole('textbox', { name: /brand \*/i }), {
      target: { name: 'brand', value: 'Thermo Fisher' },
    })

    fireEvent.change(screen.getByRole('textbox', { name: /model \*/i }), {
      target: { name: 'model', value: 'TX-200' },
    })

    fireEvent.change(screen.getByRole('textbox', { name: /serial number \*/i }), {
      target: { name: 'serial_number', value: 'N/A' },
    })

    fireEvent.change(screen.getByRole('combobox', { name: /urgency \*/i }), {
      target: { name: 'urgency', value: 'high' },
    })

    fireEvent.change(screen.getByRole('combobox', { name: /category/i }), {
      target: { name: 'category_id', value: 'equipment' },
    })

    fireEvent.change(screen.getByRole('combobox', { name: /service area \(address\) \*/i }), {
      target: { name: 'address_id', value: '12' },
    })

    fireEvent.change(screen.getByLabelText(/due date \*/i), {
      target: { name: 'date', value: '2026-04-10' },
    })

    fireEvent.click(screen.getByRole('button', { name: /submit work order/i }))
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }))

    await waitFor(() => {
      expect(insertedPayload).not.toBeNull()
    })

    expect(insertedPayload).toMatchObject({
      title: 'Fix incubator alarm',
      description: 'Incubator alarm keeps triggering after restart.',
      brand: 'Thermo Fisher',
      model: 'TX-200',
      serial_number: 'N/A',
      urgency: 'high',
      date: '2026-04-10',
      category_id: 2,
      lab: 7,
      created_by: 'manager-1',
      address_id: 12,
      initial_fee: 50,
    })
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AddressManagement from '@/components/AddressManagement'

const getUserMock = vi.fn()
const fromMock = vi.fn()

vi.stubGlobal('confirm', vi.fn(() => true))

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

describe('AddressManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getUserMock.mockResolvedValue({
      data: { user: { id: 'manager-1' } },
    })

    let addressList = [
      {
        id: 1,
        lab_id: 7,
        line1: '100 Main St',
        line2: null,
        city: 'Boston',
        state: 'MA',
        zipcode: '02111',
        is_default: true,
      },
    ]

    fromMock.mockImplementation((table: string) => {
      if (table === 'labs') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: { id: 7 }, error: null }),
            })),
          })),
        }
      }

      if (table === 'addresses') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: addressList, error: null }),
            })),
          })),
          insert: vi.fn((payload: Record<string, unknown>) => {
            addressList = [
              ...addressList,
              {
                id: 2,
                is_default: false,
                ...payload,
              } as never,
            ]
            return {
              select: vi.fn().mockResolvedValue({ data: [payload], error: null }),
            }
          }),
          delete: vi.fn(() => ({
            eq: vi.fn((_: string, id: number) => {
              addressList = addressList.filter((item) => item.id !== id)
              return Promise.resolve({ error: null })
            }),
          })),
        }
      }

      return {}
    })
  })

  it('adds a new address successfully', async () => {
    render(<AddressManagement />)

    await screen.findByText('100 Main St')
    fireEvent.click(screen.getByRole('button', { name: /add new address/i }))

    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: '55 Test Ave' } })
    fireEvent.change(inputs[2], { target: { value: 'Cambridge' } })
    fireEvent.change(inputs[3], { target: { value: 'MA' } })
    fireEvent.change(inputs[4], { target: { value: '02139' } })

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByText(/address added successfully!/i)).toBeInTheDocument()
    })
    expect(screen.getByText('55 Test Ave')).toBeInTheDocument()
  })

  it('deletes an address when user confirms', async () => {
    render(<AddressManagement />)

    await screen.findByText('100 Main St')
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => {
      expect(screen.getByText(/address deleted successfully!/i)).toBeInTheDocument()
    })

    expect(screen.queryByText('100 Main St')).not.toBeInTheDocument()
  })
})

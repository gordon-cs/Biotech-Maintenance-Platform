import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WorkOrderCompletion from '@/components/WorkOrderCompletion'

const fromMock = vi.fn()
const alertMock = vi.fn()

vi.stubGlobal('alert', alertMock)

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

describe('WorkOrderCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('completes work order without creating invoice when payment is not requested', async () => {
    const onComplete = vi.fn()
    let updatePayload: Record<string, unknown> | null = null

    fromMock.mockImplementation((table: string) => {
      if (table === 'work_orders') {
        return {
          update: vi.fn((payload: Record<string, unknown>) => {
            updatePayload = payload
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            }
          }),
        }
      }

      if (table === 'invoices') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        }
      }

      return {}
    })

    render(<WorkOrderCompletion workOrderId="42" onComplete={onComplete} />)
    fireEvent.click(screen.getByRole('button', { name: /complete work order/i }))

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1)
    })

    expect(updatePayload).toMatchObject({
      status: 'completed',
      payment_requested: false,
      requested_amount: null,
      payment_status: null,
    })
    expect(alertMock).toHaveBeenCalledWith('Work order completed successfully!')
  })

  it('creates a service invoice when payment is requested', async () => {
    const onComplete = vi.fn()
    let insertedInvoice: Record<string, unknown> | null = null

    fromMock.mockImplementation((table: string) => {
      if (table === 'work_orders') {
        return {
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { lab: 9, assigned_to: 'tech-1' },
                error: null,
              }),
            })),
          })),
        }
      }

      if (table === 'invoices') {
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            insertedInvoice = payload
            return Promise.resolve({ error: null })
          }),
        }
      }

      return {}
    })

    render(<WorkOrderCompletion workOrderId="42" onComplete={onComplete} />)

    fireEvent.click(screen.getByRole('checkbox', { name: /request payment for this work/i }))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '225.75' } })
    fireEvent.click(screen.getByRole('button', { name: /complete work order/i }))

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1)
    })

    expect(insertedInvoice).toMatchObject({
      work_order_id: 42,
      lab_id: 9,
      created_by: 'tech-1',
      total_amount: 225.75,
      payment_status: 'unbilled',
      invoice_type: 'service',
    })
  })
})

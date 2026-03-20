import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSend = vi.fn().mockResolvedValue({ id: 'email-template-test-id' })

vi.mock('resend', () => {
  return {
    Resend: class MockResend {
      emails = {
        send: mockSend,
      }
    },
  }
})

const { sendWorkOrderUpdateEmail } = await import('@/lib/email')

describe('Email Template Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
  })

  it('renders production HTML template and default branding for comment updates', async () => {
    await sendWorkOrderUpdateEmail(
      { email: 'lab@example.com', name: 'Lab Manager' },
      {
        workOrderId: 123,
        workOrderTitle: 'Replace centrifuge seal',
        updateType: 'comment',
        updateBody: 'Parts are on site and repair starts tomorrow.',
        authorName: 'Jordan Tech',
        authorRole: 'Technician',
      }
    )

    expect(mockSend).toHaveBeenCalledTimes(1)
    const payload = mockSend.mock.calls[0]?.[0]

    expect(payload?.subject).toBe('New Comment on Work Order #123')
    expect(payload?.from).toBe('Boston Biotech Management <no-reply@bostonbiotechmanagement.com>')

    expect(payload?.html).toContain('<!DOCTYPE html>')
    expect(payload?.html).toContain('<html>')
    expect(payload?.html).toContain('<head>')
    expect(payload?.html).toContain('<body>')
    expect(payload?.html).toContain('Jordan Tech')
    expect(payload?.html).toContain('Comment')
    expect(payload?.html).toContain('Replace centrifuge seal')
    expect(payload?.html).toContain('http://localhost:3000/work-orders/past?selected=123')
    expect(payload?.html).toContain('Boston Biotech Management')

    expect(payload?.text).toContain('Work Order Update')
    expect(payload?.text).toContain('Message:')
    expect(payload?.text).toContain('Parts are on site and repair starts tomorrow.')
  })

  it('renders status update content and status-specific subject in production template', async () => {
    await sendWorkOrderUpdateEmail(
      { email: 'manager@example.com' },
      {
        workOrderId: 456,
        workOrderTitle: 'Recalibrate biosafety cabinet',
        updateType: 'status_change',
        newStatus: 'completed',
        updateBody: 'All QA checks passed.',
        authorName: 'Taylor Manager',
        authorRole: 'Manager',
      }
    )

    const payload = mockSend.mock.calls[0]?.[0]

    expect(payload?.subject).toBe('Work Order #456 Status Updated to completed')
    expect(payload?.html).toContain('Status Update')
    expect(payload?.html).toContain('New Status:')
    expect(payload?.html).toContain('completed')
    expect(payload?.html).toContain('Reason:')
    expect(payload?.text).toContain('New Status: completed')
    expect(payload?.text).toContain('Reason:')
  })
})

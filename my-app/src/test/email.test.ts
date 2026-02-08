import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Resend before importing
vi.mock('resend', () => {
  const mockSend = vi.fn().mockResolvedValue({ id: 'test-email-id' })
  return {
    Resend: class MockResend {
      emails = {
        send: mockSend,
      }
    },
  }
})

const { sendWorkOrderUpdateEmail } = await import('@/lib/email')
const { Resend } = await import('resend')

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sendWorkOrderUpdateEmail', () => {
    it('should send comment notification email with correct subject', async () => {
      const recipient = { email: 'lab@example.com', name: 'Lab Manager' }
      const data = {
        workOrderId: 123,
        workOrderTitle: 'Fix HVAC System',
        updateType: 'comment' as const,
        updateBody: 'Working on this now',
        authorName: 'John Tech',
        authorRole: 'Technician',
      }

      const result = await sendWorkOrderUpdateEmail(recipient, data)

      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('id')
    })

    it('should send status change notification with new status', async () => {
      const recipient = { email: 'tech@example.com', name: 'Tech User' }
      const data = {
        workOrderId: 456,
        workOrderTitle: 'Replace Filter',
        updateType: 'status_change' as const,
        newStatus: 'completed',
        updateBody: 'Filter replaced successfully',
        authorName: 'Jane Manager',
        authorRole: 'Manager',
      }

      const result = await sendWorkOrderUpdateEmail(recipient, data)

      expect(result.success).toBe(true)
    })

    it('should include recipient name in email when provided', async () => {
      const recipient = { email: 'test@example.com', name: 'Test User' }
      const data = {
        workOrderId: 100,
        workOrderTitle: 'Test Order',
        updateType: 'comment' as const,
        updateBody: 'Test message',
        authorName: 'Author',
        authorRole: 'Tech',
      }

      const result = await sendWorkOrderUpdateEmail(recipient, data)
      expect(result.success).toBe(true)
    })

    it('should handle email without recipient name', async () => {
      const recipient = { email: 'test@example.com' }
      const data = {
        workOrderId: 100,
        workOrderTitle: 'Test Order',
        updateType: 'comment' as const,
        updateBody: 'Test message',
        authorName: 'Author',
        authorRole: 'Tech',
      }

      const result = await sendWorkOrderUpdateEmail(recipient, data)
      expect(result.success).toBe(true)
    })

    it('should call resend.emails.send with correct from address', async () => {
      const mockResend = new Resend('test-key')
      const sendSpy = vi.spyOn(mockResend.emails, 'send')

      const recipient = { email: 'test@example.com' }
      const data = {
        workOrderId: 100,
        workOrderTitle: 'Test',
        updateType: 'comment' as const,
        updateBody: 'Message',
        authorName: 'Tech',
        authorRole: 'Technician',
      }

      await sendWorkOrderUpdateEmail(recipient, data)

      expect(sendSpy).toHaveBeenCalled()
      const callArgs = sendSpy.mock.calls[0]?.[0]
      expect(callArgs?.from).toContain('bostonbiotechmanagement.com')
      expect(callArgs?.from).toContain('Boston Biotech Management')
    })
  })
})

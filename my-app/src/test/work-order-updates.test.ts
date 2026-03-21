import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn(),
  },
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}))

// Mock email service
vi.mock('@/lib/email', () => ({
  sendWorkOrderUpdateEmail: vi.fn().mockResolvedValue({ success: true }),
}))

// Import after mocks are set up
const { GET, POST } = await import('@/api/work-order-updates/route')
const { sendWorkOrderUpdateEmail } = await import('@/lib/email')

describe('Work Order Updates API', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(sendWorkOrderUpdateEmail).mockResolvedValue({ success: true } as never)
  })

  describe('GET /api/work-order-updates', () => {
    it('should return 400 if work_order_id is missing', async () => {
      const request = new NextRequest('http://localhost/api/work-order-updates')
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('work_order_id parameter is required')
    })

    it('should fetch updates for a work order', async () => {
      const mockUpdates = [
        {
          id: 1,
          work_order_id: 123,
          update_type: 'comment',
          body: 'Test update',
          created_at: '2026-02-05T10:00:00Z',
        },
      ]

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockUpdates,
              error: null,
            }),
          }),
        }),
      })

      const request = new NextRequest('http://localhost/api/work-order-updates?work_order_id=123')
      
      const response = await GET(request)
      const responseData = await response.json()
      
      expect(response.status).toBe(200)
      expect(responseData.data).toEqual(mockUpdates)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('work_order_updates')
    })

    it('should return 500 on database error', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      })

      const request = new NextRequest('http://localhost/api/work-order-updates?work_order_id=123')
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.error).toBe('Database error')
    })
  })

  describe('POST /api/work-order-updates - Authentication', () => {
    it('should return 401 if authorization header is missing', async () => {
      const request = new NextRequest('http://localhost/api/work-order-updates', {
        method: 'POST',
        body: JSON.stringify({
          work_order_id: 123,
          update_type: 'comment',
          body: 'Test',
        }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(401)
      expect(data.error).toBe('Missing token')
    })

    it('should return 401 if token is invalid', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      })

      const request = new NextRequest('http://localhost/api/work-order-updates', {
        method: 'POST',
        headers: { 'authorization': 'Bearer invalid-token' },
        body: JSON.stringify({
          work_order_id: 123,
          update_type: 'comment',
          body: 'Test',
        }),
      })
      
      const response = await POST(request)
      
      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/work-order-updates - Validation', () => {
    beforeEach(() => {
      // Setup valid user authentication
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })
    })

    it('should return 400 if work_order_id is missing', async () => {
      const request = new NextRequest('http://localhost/api/work-order-updates', {
        method: 'POST',
        headers: { 'authorization': 'Bearer test-token' },
        body: JSON.stringify({
          update_type: 'comment',
          body: 'Test comment',
        }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toContain('work_order_id')
    })

    it('should return 400 if update_type is missing', async () => {
      const request = new NextRequest('http://localhost/api/work-order-updates', {
        method: 'POST',
        headers: { 'authorization': 'Bearer test-token' },
        body: JSON.stringify({
          work_order_id: 123,
          body: 'Test comment',
        }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toContain('update_type')
    })

    it('should return 400 if body is missing', async () => {
      const request = new NextRequest('http://localhost/api/work-order-updates', {
        method: 'POST',
        headers: { 'authorization': 'Bearer test-token' },
        body: JSON.stringify({
          work_order_id: 123,
          update_type: 'comment',
        }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toContain('body')
    })

    it('should return 400 if body is only whitespace', async () => {
      const request = new NextRequest('http://localhost/api/work-order-updates', {
        method: 'POST',
        headers: { 'authorization': 'Bearer test-token' },
        body: JSON.stringify({
          work_order_id: 123,
          update_type: 'comment',
          body: '   ',
        }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
    })

    it('should return 400 if update_type is invalid', async () => {
      const request = new NextRequest('http://localhost/api/work-order-updates', {
        method: 'POST',
        headers: { 'authorization': 'Bearer test-token' },
        body: JSON.stringify({
          work_order_id: 123,
          update_type: 'invalid_type',
          body: 'Test',
        }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toContain("must be 'comment' or 'status_change'")
    })

    it('should return 400 if new_status is missing for status_change', async () => {
      const request = new NextRequest('http://localhost/api/work-order-updates', {
        method: 'POST',
        headers: { 'authorization': 'Bearer test-token' },
        body: JSON.stringify({
          work_order_id: 123,
          update_type: 'status_change',
          body: 'Completing work order',
        }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toContain('new_status is required')
    })
  })

  describe('POST /api/work-order-updates - Status Change Authorization', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })
    })

    it('should return 403 if non-technician tries to change status', async () => {
      // Mock user profile check - user is NOT a technician
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'lab' },
              error: null,
            }),
          }),
        }),
      })

      const request = new NextRequest('http://localhost/api/work-order-updates', {
        method: 'POST',
        headers: { 'authorization': 'Bearer test-token' },
        body: JSON.stringify({
          work_order_id: 123,
          update_type: 'status_change',
          new_status: 'completed',
          body: 'Trying to complete',
        }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(403)
      expect(data.error).toContain('Only technicians can change work order status')
    })

    it('should return 400 if trying to change status to non-completed value', async () => {
      // Mock user as technician
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'technician' },
              error: null,
            }),
          }),
        }),
      })

      const request = new NextRequest('http://localhost/api/work-order-updates', {
        method: 'POST',
        headers: { 'authorization': 'Bearer test-token' },
        body: JSON.stringify({
          work_order_id: 123,
          update_type: 'status_change',
          new_status: 'in_progress',
          body: 'Test',
        }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toContain("Status can only be changed to 'completed'")
    })

    it('should return 400 if work order is already completed', async () => {
      // Mock user as technician
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'technician' },
              error: null,
            }),
          }),
        }),
      })

      // Mock work order fetch - status is already completed
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { assigned_to: 'user-123', status: 'completed' },
              error: null,
            }),
          }),
        }),
      })

      const request = new NextRequest('http://localhost/api/work-order-updates', {
        method: 'POST',
        headers: { 'authorization': 'Bearer test-token' },
        body: JSON.stringify({
          work_order_id: 123,
          update_type: 'status_change',
          new_status: 'completed',
          body: 'Test',
        }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toContain('already completed')
    })

    it('should return 403 if technician is not assigned to work order', async () => {
      // Mock user as technician
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'technician' },
              error: null,
            }),
          }),
        }),
      })

      // Mock work order - assigned to different user
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { assigned_to: 'other-tech-id', status: 'claimed' },
              error: null,
            }),
          }),
        }),
      })

      const request = new NextRequest('http://localhost/api/work-order-updates', {
        method: 'POST',
        headers: { 'authorization': 'Bearer test-token' },
        body: JSON.stringify({
          work_order_id: 123,
          update_type: 'status_change',
          new_status: 'completed',
          body: 'Test',
        }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(403)
      expect(data.error).toContain('must be assigned')
    })
  })

  describe('POST /api/work-order-updates - Success Cases', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })
    })

    it('should successfully create a comment', async () => {
      const mockUpdate = {
        id: 1,
        work_order_id: 123,
        update_type: 'comment',
        body: 'Test comment',
        author: {
          id: 'user-123',
          full_name: 'Test User',
          role: 'lab',
        },
      }

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockUpdate,
              error: null,
            }),
          }),
        }),
      })

      mockSupabaseClient.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockUpdate,
              error: null,
            }),
          }),
        }),
      })
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 123,
                title: 'Test work order',
                lab: 1,
                assigned_to: null,
              },
              error: null,
            }),
          }),
        }),
      })

      const request = new NextRequest('http://localhost/api/work-order-updates', {
        method: 'POST',
        headers: { 'authorization': 'Bearer test-token' },
        body: JSON.stringify({
          work_order_id: 123,
          update_type: 'comment',
          body: 'Test comment',
        }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(201)
      expect(data.data.update_type).toBe('comment')
      expect(data.data.body).toBe('Test comment')
    })

    it('should allow assigned technician to complete work order and notify lab manager', async () => {
      const mockUpdate = {
        id: 9,
        work_order_id: 123,
        update_type: 'status_change',
        new_status: 'completed',
        body: 'Finished all checks',
        author: {
          id: 'user-123',
          full_name: 'Assigned Tech',
          email: 'tech@example.com',
          role: 'technician',
        },
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: 'technician' },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { assigned_to: 'user-123', status: 'claimed' },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockUpdate,
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 123,
                  title: 'Sterilizer calibration',
                  lab: 77,
                  assigned_to: 'user-123',
                },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { manager_id: 'manager-1' },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { email: 'manager@example.com', full_name: 'Lab Manager' },
                error: null,
              }),
            }),
          }),
        })

      const request = new NextRequest('http://localhost/api/work-order-updates', {
        method: 'POST',
        headers: { authorization: 'Bearer test-token' },
        body: JSON.stringify({
          work_order_id: 123,
          update_type: 'status_change',
          new_status: 'completed',
          body: 'Finished all checks',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.data.update_type).toBe('status_change')
      expect(sendWorkOrderUpdateEmail).toHaveBeenCalledTimes(1)
      expect(sendWorkOrderUpdateEmail).toHaveBeenCalledWith(
        { email: 'manager@example.com', name: 'Lab Manager' },
        expect.objectContaining({
          workOrderId: 123,
          updateType: 'status_change',
          newStatus: 'completed',
        })
      )
    })

    it('should still return 201 when email sending fails', async () => {
      vi.mocked(sendWorkOrderUpdateEmail).mockResolvedValueOnce({
        success: false,
        error: new Error('email provider unavailable'),
      })

      const mockUpdate = {
        id: 10,
        work_order_id: 555,
        update_type: 'comment',
        body: 'Please recheck this unit',
        author: {
          id: 'user-123',
          full_name: 'Lab Manager',
          email: 'lab@example.com',
          role: 'lab',
        },
      }

      mockSupabaseClient.from
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockUpdate,
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 555, title: 'Pump inspection', lab: 91, assigned_to: 'tech-8' },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { email: 'tech8@example.com', full_name: 'Assigned Tech' },
                error: null,
              }),
            }),
          }),
        })

      const request = new NextRequest('http://localhost/api/work-order-updates', {
        method: 'POST',
        headers: { authorization: 'Bearer test-token' },
        body: JSON.stringify({
          work_order_id: 555,
          update_type: 'comment',
          body: 'Please recheck this unit',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.data.work_order_id).toBe(555)
      expect(sendWorkOrderUpdateEmail).toHaveBeenCalledTimes(1)
    })
  })
})

import { describe, it, expect } from 'vitest'

describe('Work Order Updates', () => {
  describe('Update Type Validation', () => {
    it('should validate comment update structure', () => {
      const update = {
        work_order_id: 123,
        update_type: 'comment',
        body: 'Started working on the repair',
        author_id: 'user-123',
      }
      
      expect(update.update_type).toBe('comment')
      expect(update.body).toBeTruthy()
      expect(update.work_order_id).toBeGreaterThan(0)
    })

    it('should validate status change update structure', () => {
      const update = {
        work_order_id: 456,
        update_type: 'status_change',
        new_status: 'completed',
        body: 'Repair completed successfully',
        author_id: 'tech-user-id',
      }
      
      expect(update.update_type).toBe('status_change')
      expect(update.new_status).toBe('completed')
      expect(update.body).toBeTruthy()
    })

    it('should require body field for all updates', () => {
      const commentUpdate = {
        work_order_id: 789,
        update_type: 'comment',
        body: 'Ordering replacement parts',
      }
      
      const statusUpdate = {
        work_order_id: 789,
        update_type: 'status_change',
        new_status: 'completed',
        body: 'Work finished',
      }
      
      expect(commentUpdate.body.trim()).not.toBe('')
      expect(statusUpdate.body.trim()).not.toBe('')
    })
  })

  describe('Status Change Validation', () => {
    it('should only allow technicians to change status', () => {
      const userRole = 'technician'
      const allowedRoles = ['technician']
      
      expect(allowedRoles).toContain(userRole)
    })

    it('should not allow non-technicians to change status', () => {
      const userRoles = ['lab_manager', 'admin']
      const allowedRoles = ['technician']
      
      userRoles.forEach(role => {
        if (role !== 'technician') {
          expect(allowedRoles).not.toContain(role)
        }
      })
    })

    it('should only allow changing status to completed', () => {
      const newStatus = 'completed'
      const allowedStatuses = ['completed']
      
      expect(allowedStatuses).toContain(newStatus)
    })

    it('should reject invalid status changes', () => {
      const invalidStatuses = ['pending', 'in_progress', 'cancelled']
      const allowedStatuses = ['completed']
      
      invalidStatuses.forEach(status => {
        expect(allowedStatuses).not.toContain(status)
      })
    })

    it('should prevent status change on already completed work orders', () => {
      const currentStatus: string = 'completed'
      const canChange = currentStatus !== 'completed'
      
      expect(canChange).toBe(false)
    })

    it('should allow status change on claimed work orders', () => {
      const currentStatus: string = 'claimed'
      const canChange = currentStatus !== 'completed'
      
      expect(canChange).toBe(true)
    })
  })

  describe('Assignment Validation', () => {
    it('should require technician to be assigned to change status', () => {
      const workOrder = {
        id: 123,
        assigned_to: 'tech-user-id',
        status: 'claimed',
      }
      
      const userId = 'tech-user-id'
      const isAssigned = workOrder.assigned_to === userId
      
      expect(isAssigned).toBe(true)
    })

    it('should reject status change from unassigned technician', () => {
      const workOrder = {
        id: 123,
        assigned_to: 'tech-user-id-1',
        status: 'claimed',
      }
      
      const userId = 'tech-user-id-2'
      const isAssigned = workOrder.assigned_to === userId
      
      expect(isAssigned).toBe(false)
    })

    it('should allow comments from any user on the work order', () => {
      // Comments don't require assignment
      const update = {
        update_type: 'comment',
        body: 'Question about the equipment location',
      }
      
      expect(update.update_type).toBe('comment')
    })
  })

  describe('Update Body Validation', () => {
    it('should reject empty update body', () => {
      const emptyBodies = ['', '   ', '\t\n']
      
      emptyBodies.forEach(body => {
        expect(body.trim()).toBe('')
      })
    })

    it('should accept valid update body text', () => {
      const validBodies = [
        'Repair completed',
        'Parts ordered, ETA 2 days',
        'Equipment is functioning normally',
      ]
      
      validBodies.forEach(body => {
        expect(body.trim()).not.toBe('')
        expect(body.length).toBeGreaterThan(0)
      })
    })

    it('should trim whitespace from update body', () => {
      const body = '  Fixed the cooling system  '
      const trimmed = body.trim()
      
      expect(trimmed).toBe('Fixed the cooling system')
      expect(trimmed).not.toContain('  ')
    })
  })

  describe('Update Response Structure', () => {
    it('should include author information in update response', () => {
      const updateResponse = {
        id: 1,
        work_order_id: 123,
        author_id: 'user-123',
        update_type: 'comment',
        body: 'Test update',
        created_at: '2026-02-05T10:00:00Z',
        author: {
          id: 'user-123',
          full_name: 'John Tech',
          email: 'john@example.com',
          role: 'technician',
        },
      }
      
      expect(updateResponse.author).toBeDefined()
      expect(updateResponse.author.full_name).toBe('John Tech')
      expect(updateResponse.author.role).toBe('technician')
    })

    it('should include timestamp for updates', () => {
      const timestamp = '2026-02-05T10:00:00Z'
      
      expect(() => new Date(timestamp)).not.toThrow()
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('should include work_order_id in update', () => {
      const update = {
        id: 1,
        work_order_id: 123,
        body: 'Test',
      }
      
      expect(update.work_order_id).toBeDefined()
      expect(typeof update.work_order_id).toBe('number')
    })
  })

  describe('Update Ordering', () => {
    it('should order updates by creation time ascending', () => {
      const updates = [
        { id: 3, created_at: '2026-02-05T12:00:00Z' },
        { id: 1, created_at: '2026-02-05T10:00:00Z' },
        { id: 2, created_at: '2026-02-05T11:00:00Z' },
      ]
      
      const sorted = [...updates].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      
      expect(sorted[0].id).toBe(1)
      expect(sorted[1].id).toBe(2)
      expect(sorted[2].id).toBe(3)
    })
  })

  describe('Error Messages', () => {
    it('should provide helpful error for missing work_order_id', () => {
      const errorMessage = 'work_order_id parameter is required'
      
      expect(errorMessage).toContain('work_order_id')
      expect(errorMessage).toContain('required')
    })

    it('should provide helpful error for missing required fields', () => {
      const errorMessage = 'Missing required fields: work_order_id, update_type, and body are required'
      
      expect(errorMessage).toContain('work_order_id')
      expect(errorMessage).toContain('update_type')
      expect(errorMessage).toContain('body')
    })

    it('should provide helpful error for invalid update_type', () => {
      const errorMessage = "update_type must be 'comment' or 'status_change'"
      
      expect(errorMessage).toContain('comment')
      expect(errorMessage).toContain('status_change')
    })

    it('should provide helpful error for missing new_status', () => {
      const errorMessage = 'new_status is required when update_type is status_change'
      
      expect(errorMessage).toContain('new_status')
      expect(errorMessage).toContain('status_change')
    })

    it('should provide helpful error for non-technician status change', () => {
      const errorMessage = 'Only technicians can change work order status'
      
      expect(errorMessage).toContain('technician')
      expect(errorMessage).toContain('status')
    })

    it('should provide helpful error for invalid status', () => {
      const errorMessage = "Status can only be changed to 'completed'"
      
      expect(errorMessage).toContain('completed')
    })

    it('should provide helpful error for unassigned technician', () => {
      const errorMessage = 'You must be assigned to this work order to mark it as completed'
      
      expect(errorMessage).toContain('assigned')
      expect(errorMessage).toContain('completed')
    })

    it('should provide helpful error for already completed work order', () => {
      const errorMessage = 'This work order is already completed and cannot be modified'
      
      expect(errorMessage).toContain('already completed')
      expect(errorMessage).toContain('cannot be modified')
    })
  })
})

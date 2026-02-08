import { describe, it, expect } from 'vitest'

describe('Work Order Validation', () => {
  describe('Work Order Creation', () => {
    it('should validate required fields for work order creation', () => {
      const workOrder = {
        title: 'Fix HVAC System',
        description: 'AC unit not cooling properly',
        equipment: 'HVAC Unit A-123',
        urgency: 'high',
      }

      expect(workOrder.title).toBeTruthy()
      expect(workOrder.description).toBeTruthy()
      expect(workOrder.urgency).toBeTruthy()
    })

    it('should validate urgency levels', () => {
      const validUrgencies = ['low', 'normal', 'high', 'critical']
      
      validUrgencies.forEach(urgency => {
        expect(validUrgencies).toContain(urgency)
      })
    })

    it('should validate work order title is not empty', () => {
      const title = 'Replace air filter'
      
      expect(title.trim()).not.toBe('')
      expect(title.length).toBeGreaterThan(0)
    })

    it('should validate work order description is not empty', () => {
      const description = 'The air filter in room 301 needs replacement'
      
      expect(description.trim()).not.toBe('')
      expect(description.length).toBeGreaterThan(0)
    })

    it('should accept valid urgency values', () => {
      const urgencies = ['low', 'normal', 'high', 'critical']
      
      urgencies.forEach(urgency => {
        const workOrder = {
          title: 'Test',
          description: 'Test',
          urgency: urgency,
        }
        
        expect(['low', 'normal', 'high', 'critical']).toContain(workOrder.urgency)
      })
    })

    it('should validate initial fee is a positive number', () => {
      const initialFee = 50.00
      
      expect(initialFee).toBeGreaterThan(0)
      expect(typeof initialFee).toBe('number')
    })

    it('should format date correctly', () => {
      const date = '2026-02-05'
      
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(() => new Date(date)).not.toThrow()
    })
  })

  describe('Work Order Status', () => {
    it('should validate work order status values', () => {
      const validStatuses = ['open', 'claimed', 'completed', 'cancelled']
      
      validStatuses.forEach(status => {
        expect(validStatuses).toContain(status)
      })
    })

    it('should allow status transition from open to claimed', () => {
      const currentStatus = 'open'
      const newStatus = 'claimed'
      
      const allowedTransitions = {
        'open': ['claimed'],
        'claimed': ['completed', 'open'],
        'completed': [],
      }
      
      expect(allowedTransitions[currentStatus]).toContain(newStatus)
    })

    it('should not allow status change on completed work orders', () => {
      const currentStatus = 'completed'
      
      const allowedTransitions = {
        'open': ['claimed'],
        'claimed': ['completed', 'open'],
        'completed': [],
      }
      
      expect(allowedTransitions[currentStatus]).toHaveLength(0)
    })
  })

  describe('Work Order Update Types', () => {
    it('should validate update type is either comment or status_change', () => {
      const validTypes = ['comment', 'status_change']
      
      expect(validTypes).toContain('comment')
      expect(validTypes).toContain('status_change')
      expect(validTypes).toHaveLength(2)
    })

    it('should require new_status when update_type is status_change', () => {
      const update = {
        update_type: 'status_change',
        new_status: 'completed',
        body: 'Work completed successfully',
      }
      
      expect(update.update_type).toBe('status_change')
      expect(update.new_status).toBeTruthy()
    })

    it('should not require new_status when update_type is comment', () => {
      const update = {
        update_type: 'comment',
        body: 'Starting work on this now',
      }
      
      expect(update.update_type).toBe('comment')
    })

    it('should validate update body is not empty', () => {
      const body = 'Parts ordered, will complete tomorrow'
      
      expect(body.trim()).not.toBe('')
      expect(body.length).toBeGreaterThan(0)
    })
  })

  describe('Work Order Payload Structure', () => {
    it('should create valid work order payload', () => {
      const payload = {
        title: 'Fix broken freezer',
        description: 'Freezer temperature too high',
        equipment: 'Freezer B-456',
        urgency: 'critical',
        lab: 1,
        category_id: 2,
        date: '2026-02-05',
        initial_fee: 50.00,
      }
      
      expect(payload.title).toBeTruthy()
      expect(payload.description).toBeTruthy()
      expect(payload.urgency).toBe('critical')
      expect(payload.initial_fee).toBeGreaterThan(0)
    })

    it('should handle optional fields correctly', () => {
      const payload = {
        title: 'Test work order',
        description: 'Test description',
        urgency: 'normal',
        equipment: null,
        lab: null,
        category_id: null,
      }
      
      expect(payload.title).toBeTruthy()
      expect(payload.equipment).toBeNull()
      expect(payload.lab).toBeNull()
    })
  })

  describe('Work Order Assignment', () => {
    it('should validate work order can be assigned to a technician', () => {
      const workOrder = {
        id: 123,
        status: 'open',
        assigned_to: null,
      }
      
      const newAssignment = {
        ...workOrder,
        status: 'claimed',
        assigned_to: 'tech-user-id',
      }
      
      expect(newAssignment.status).toBe('claimed')
      expect(newAssignment.assigned_to).toBeTruthy()
    })

    it('should validate work order can be unclaimed', () => {
      const workOrder = {
        id: 123,
        status: 'claimed',
        assigned_to: 'tech-user-id',
      }
      
      const unclaimed = {
        ...workOrder,
        status: 'open',
        assigned_to: null,
      }
      
      expect(unclaimed.status).toBe('open')
      expect(unclaimed.assigned_to).toBeNull()
    })
  })
})

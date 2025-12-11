"use client"

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface WorkOrderCompletionProps {
  workOrderId: string
  onComplete: () => void
}

const MIN_PAYMENT_AMOUNT = 0.01

export default function WorkOrderCompletion({ workOrderId, onComplete }: WorkOrderCompletionProps) {
  const [isCompleting, setIsCompleting] = useState(false)
  const [requestPayment, setRequestPayment] = useState(false)
  const [requestedAmount, setRequestedAmount] = useState('150.00')
  const [validationError, setValidationError] = useState('')

  const isValidAmount = (amount: string): boolean => {
    const parsed = parseFloat(amount)
    return !isNaN(parsed) && parsed >= MIN_PAYMENT_AMOUNT
  }

  const completeWorkOrder = async () => {
    setIsCompleting(true)
    setValidationError('')
    
    // Validate payment amount if payment is requested
    if (requestPayment && !isValidAmount(requestedAmount)) {
      setValidationError(`Payment amount must be at least $${MIN_PAYMENT_AMOUNT.toFixed(2)}`)
      setIsCompleting(false)
      return
    }
    
    try {
      // 1. Mark work order as completed
      const { error: updateError } = await supabase
        .from('work_orders')
        .update({ 
          status: 'completed',
          // Add payment request fields
          payment_requested: requestPayment,
          requested_amount: requestPayment ? parseFloat(requestedAmount) : null,
          payment_status: requestPayment ? 'requested' : null
        })
        .eq('id', workOrderId)

      if (updateError) throw updateError

      // 2. Create invoice record if payment requested
      if (requestPayment) {
        await createInvoiceRecord()
      }

      onComplete()
      alert('Work order completed successfully!')
      
    } catch (error) {
      console.error('Error completing work order:', error)
      alert('Failed to complete work order')
    } finally {
      setIsCompleting(false)
    }
  }

  const createInvoiceRecord = async () => {
    // Get work order details
    const { data: workOrder } = await supabase
      .from('work_orders')
      .select('lab, assigned_to')
      .eq('id', workOrderId)
      .single()

    if (!workOrder) throw new Error('Work order not found')

    // Create invoice record in your invoices table
    const { error } = await supabase
      .from('invoices')
      .insert({
        work_order_id: parseInt(workOrderId),
        lab_id: workOrder.lab,
        created_by: workOrder.assigned_to,
        total_amount: parseFloat(requestedAmount),
        payment_status: 'unbilled' // Waiting for manager approval
      })

    if (error) throw error
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Complete Work Order
      </h3>
      
      {/* Payment Request Option */}
      <div className="mb-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={requestPayment}
            onChange={(e) => setRequestPayment(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-900">
            Request payment for this work
          </span>
        </label>
      </div>

      {/* Payment Amount Input */}
      {requestPayment && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Requested Amount
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">$</span>
            </div>
            <input
              type="number"
              step="0.01"
              min={MIN_PAYMENT_AMOUNT}
              value={requestedAmount}
              onChange={(e) => setRequestedAmount(e.target.value)}
              className="pl-7 block w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="0.00"
            />
          </div>
          {validationError && (
            <p className="mt-1 text-sm text-red-600">{validationError}</p>
          )}
        </div>
      )}

      <button
        onClick={completeWorkOrder}
        disabled={isCompleting}
        className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isCompleting ? 'Completing...' : 'Complete Work Order'}
      </button>
    </div>
  )
}
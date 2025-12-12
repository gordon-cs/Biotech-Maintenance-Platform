"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface PaymentRequest {
  id: number
  work_order_id: number
  lab_id: number
  created_by: string
  total_amount: number
  payment_status: string
  created_at: string
  work_orders?: {
    id: number
    title: string
    description: string
  }
  labs?: {
    id: number
    name: string
    bill_customer_id?: string
  }
}

export default function PaymentRequests() {
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null)
  const [isApproving, setIsApproving] = useState(false)

  useEffect(() => {
    loadPaymentRequests()
  }, [])

  const loadPaymentRequests = async () => {
    try {
      setLoading(true)
      
      // Fetch unbilled invoices with related data
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          work_orders (
            id,
            title,
            description
          ),
          labs (
            id,
            name,
            bill_customer_id
          )
        `)
        .eq('payment_status', 'unbilled')
        .order('created_at', { ascending: false })

      if (error) {
        return
      }

      setRequests(data || [])
      
      // Auto-select first request
      if (data && data.length > 0) {
        setSelectedRequest(data[0])
      }
    } catch (err) {
    } finally {
      setLoading(false)
    }
  }

  const handleApprovePayment = async (request: PaymentRequest) => {
    if (!confirm(`Approve payment of $${Number(request.total_amount).toFixed(2)}?`)) {
      return
    }

    setIsApproving(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        alert('Please login first')
        return
      }

      const response = await fetch('/api/bill/create-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ invoiceId: request.id })
      })

      const result = await response.json()

      if (response.ok) {
        alert('Payment approved and sent to Bill.com!')
        loadPaymentRequests()
      } else {
        alert(`Failed to approve payment: ${result.error}`)
      }
    } catch (error) {
      alert('Failed to approve payment')
    } finally {
      setIsApproving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading payment requests...</p>
        </div>
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Payment Requests</h1>
          <div className="bg-white border-2 border-gray-200 rounded-lg p-12 text-center">
            <div className="text-6xl mb-4"></div>
            <p className="text-xl text-gray-500">No pending payment requests</p>
            <p className="text-sm text-gray-400 mt-2">
              Payment requests will appear here when technicians complete work orders
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Payment Requests</h1>
          <p className="text-gray-600 mt-2">
            Review and approve payment requests from completed work orders
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Request List */}
          <div className="lg:col-span-1 space-y-3">
            <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-600 mb-3">
                {requests.length} Pending Request{requests.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">
              {requests.map((request) => (
                <div
                  key={request.id}
                  onClick={() => setSelectedRequest(request)}
                  className={`bg-white p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                    selectedRequest?.id === request.id
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        Invoice #{request.id}
                      </p>
                      <p className="text-sm text-gray-600 truncate">
                        {request.work_orders?.title || 'No title'}
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-medium whitespace-nowrap ml-2">
                      Unbilled
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-lg font-bold text-green-600">
                      ${request.total_amount ? Number(request.total_amount).toFixed(2) : '0.00'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {request.labs?.name || 'Unknown lab'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Request Details */}
          <div className="lg:col-span-2">
            {selectedRequest && (
              <div className="bg-white border-2 border-gray-200 rounded-lg p-6 sticky top-6">
                <div className="mb-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        Invoice #{selectedRequest.id}
                      </h2>
                      <p className="text-gray-600 mt-1">
                        Work Order #{selectedRequest.work_order_id}
                      </p>
                    </div>
                    <span className="px-4 py-2 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
                      ⏳ Payment Requested
                    </span>
                  </div>

                  {/* Amount and Lab Info */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border-2 border-green-300">
                      <p className="text-sm text-green-700 mb-1 font-semibold">Requested Amount</p>
                      <p className="text-4xl font-bold text-green-900">
                        ${selectedRequest.total_amount ? Number(selectedRequest.total_amount).toFixed(2) : '0.00'}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border-2 border-blue-300">
                      <p className="text-sm text-blue-700 mb-1 font-semibold">Lab</p>
                      <p className="text-xl font-bold text-blue-900">
                        {selectedRequest.labs?.name || 'Unknown'}
                      </p>
                      {selectedRequest.labs?.bill_customer_id && (
                        <p className="text-xs text-blue-600 mt-1">
                          ✅ Bill.com configured
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Work Order Details */}
                  <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
                    <p className="text-sm font-semibold text-gray-700 mb-2">📋 Work Order Details</p>
                    <p className="font-semibold text-gray-900">
                      {selectedRequest.work_orders?.title || 'No title'}
                    </p>
                    {selectedRequest.work_orders?.description && (
                      <p className="text-sm text-gray-600 mt-2">
                        {selectedRequest.work_orders.description}
                      </p>
                    )}
                  </div>

                  {/* Request Date */}
                  <div className="text-sm text-gray-500 mb-6">
                    <p>
                      🕐 Requested on: {new Date(selectedRequest.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {/* Warning if lab not configured */}
                  {!selectedRequest.labs?.bill_customer_id && (
                    <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-6">
                      <div className="flex items-start">
                        <span className="text-2xl mr-3">⚠️</span>
                        <div>
                          <p className="font-semibold text-yellow-900">Lab Not Configured</p>
                          <p className="text-sm text-yellow-700 mt-1">
                            This lab needs to be set up in Bill.com before payments can be processed.
                            Please add a bill_customer_id to this lab.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Approve Button */}
                <button
                  onClick={() => handleApprovePayment(selectedRequest)}
                  disabled={isApproving}
                  className="w-full bg-green-600 text-white py-4 px-6 rounded-lg font-bold text-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg"
                >
                  {isApproving ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      Processing Payment...
                    </span>
                  ) : (
                    '✓ Approve & Pay via Bill.com'
                  )}
                </button>

                {/* Info Box */}
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>ℹ️ What happens next?</strong><br/>
                    • AR Invoice will be created in Bill.com<br/>
                    • Payment link will be emailed to the lab manager<br/>
                    • Lab manager clicks &quot;Pay&quot; in email → pays on Bill.com hosted page<br/>
                    • Payment status automatically updates to &quot;Paid&quot; via webhook
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
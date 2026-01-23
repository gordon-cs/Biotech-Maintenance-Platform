"use client"

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface Invoice {
  id: number
  work_order_id: number
  invoice_type: string
  payment_status: string
  total_amount: number
  bill_ar_invoice_id: string | null
  created_at: string
}

export default function MarkPaidPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState<number | null>(null)

  useEffect(() => {
    loadInvoices()
  }, [])

  const loadInvoices = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('invoice_type', 'service')
        .in('payment_status', ['unbilled', 'awaiting_payment'])
        .order('id', { ascending: false })

      if (error) {
        alert('Error: ' + error.message)
        return
      }

      setInvoices(data || [])
    } catch (_err) {
      alert('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }

  const markAsPaid = async (invoiceId: number) => {
    if (!confirm('Mark this service invoice as PAID?\n\nThis simulates the lab paying the invoice in Bill.com.')) {
      return
    }

    setUpdating(invoiceId)
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          payment_status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', invoiceId)

      if (error) {
        alert('Error: ' + error.message)
        return
      }

      alert('✅ Invoice marked as PAID!\n\nNow go to /admin/payments to create vendor bill.')
      loadInvoices()
    } catch (_err) {
      alert('Failed to update invoice')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Mark Service Invoices as Paid</h1>
          <p className="text-gray-600 mt-2">
            Simulate labs paying service invoices (for testing technician payment flow)
          </p>
        </div>

        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-900">
            <strong>ℹ️ Testing Flow:</strong><br/>
            1. Mark a service invoice as &quot;Paid&quot; here<br/>
            2. Go to /admin/payments<br/>
            3. Click &quot;Create Vendor Bill&quot; to pay the technician<br/>
            4. Check Bill.com for the created vendor bill
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading invoices...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="bg-white rounded-lg border-2 border-gray-200 p-12 text-center">
            <p className="text-xl text-gray-500">No unpaid service invoices found</p>
            <p className="text-sm text-gray-400 mt-2">
              Service invoices are created when technicians complete work orders
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Work Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{invoice.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      WO-{invoice.work_order_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                      ${Number(invoice.total_amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">
                        {invoice.payment_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                      {new Date(invoice.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => markAsPaid(invoice.id)}
                        disabled={updating === invoice.id}
                        className="bg-green-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updating === invoice.id ? '⏳ Updating...' : '✅ Mark as Paid'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import React, { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

type Props = {
  selectedId: number | null
  onSubmitted?: (woId: number) => void
}

export default function PaymentRequestPanel({ selectedId, onSubmitted }: Props) {
  const [loading, setLoading] = useState(false)
  const [orderStatus, setOrderStatus] = useState<string | null>(null)
  const [invoice, setInvoice] = useState<{ id: number; payment_status: string | null; paid_at: string | null } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [amount, setAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setShowForm(false)
    setAmount("")
    setInvoice(null)
    setOrderStatus(null)

    if (!selectedId) return

    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        // load work order status
        const { data: wo } = await supabase
          .from("work_orders")
          .select("status")
          .eq("id", selectedId)
          .maybeSingle()
        if (!mounted) return
        setOrderStatus((wo?.status || null)?.toString().toLowerCase() ?? null)

        // load related service invoice (if any)
        const { data: inv } = await supabase
          .from("invoices")
          .select("id, payment_status, paid_at")
          .eq("work_order_id", selectedId)
          .eq("invoice_type", "service")
          .maybeSingle()
        if (!mounted) return
        setInvoice(inv ?? null)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("PaymentRequestPanel load error", e)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [selectedId])

  // Only render if a work order is selected
  if (!selectedId) return null

  // Only show panel for completed work orders (per request)
  if (orderStatus !== "completed") return null

  const invoiceExists = !!invoice
  const invoicePaid = invoice && invoice.payment_status === "paid"

  const submit = async () => {
    if (!selectedId) return
    const total = parseFloat(amount || "0")
    if (isNaN(total) || total <= 0) {
      alert("Enter a valid amount")
      return
    }

    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert("Please sign in")
        return
      }

      // fetch work order lab
      const { data: woRow, error: woError } = await supabase
        .from("work_orders")
        .select("lab")
        .eq("id", selectedId)
        .maybeSingle()
      if (woError || !woRow) {
        alert("Work order not found")
        return
      }

      const { error } = await supabase
        .from("invoices")
        .insert({
          work_order_id: selectedId,
          lab_id: woRow.lab ?? null,
          created_by: user.id,
          total_amount: total,
          payment_status: "unbilled",
          invoice_type: "service"
        })
      if (error) {
        alert("Failed to create payment request: " + error.message)
        return
      }

      alert("💰 Payment request submitted successfully!")
      setShowForm(false)
      // reload invoice state
      const { data: inv } = await supabase
        .from("invoices")
        .select("id, payment_status, paid_at")
        .eq("work_order_id", selectedId)
        .eq("invoice_type", "service")
        .maybeSingle()
      setInvoice(inv ?? null)
      onSubmitted?.(selectedId)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
      alert("Failed to submit payment request")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-6 rounded-lg border bg-white p-4">
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span className="text-2xl">💰</span>
          Payment Request
        </h3>

        {invoiceExists && !invoicePaid && (
          <div className="text-sm text-gray-600 flex items-center gap-2">
            <span className="px-2 py-1 rounded text-green-700 bg-green-50 border border-green-100">✓ Request Sent</span>
          </div>
        )}
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : invoicePaid ? (
          <div className="border border-green-200 bg-green-50 rounded-md p-4 flex items-center gap-4">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-green-700" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M20 6L9 17l-5-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-green-800">Payment Completed</div>
              {invoice?.paid_at && (
                <div className="text-sm text-green-700">Paid on {new Date(invoice.paid_at).toLocaleDateString()}</div>
              )}
            </div>
          </div>
        ) : invoiceExists ? (
          <div className="border border-yellow-200 bg-yellow-50 rounded-md p-4">
            <div className="font-medium text-yellow-800">Request Sent</div>
            <div className="text-sm text-gray-600">Awaiting payment</div>
          </div>
        ) : (
          <div className="flex items-center justify-end">
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-full text-sm"
              >
                Request Payment
              </button>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void submit()
                }}
                className="flex items-center gap-3"
              >
                <input
                  className="w-36 px-3 py-2 border rounded-md text-sm"
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setAmount("")
                  }}
                  className="px-3 py-2 border rounded-md text-sm"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
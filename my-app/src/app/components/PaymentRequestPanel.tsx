"use client"

import React, { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"

type Props = {
  selectedId: number | null
  currentOrderStatus?: string | null
  onSubmitted?: (woId: number) => void
}

type InvoiceData = { id: number; payment_status: string | null; paid_at: string | null }

export default function PaymentRequestPanel({ selectedId, currentOrderStatus, onSubmitted }: Props) {
  const [loading, setLoading] = useState(false)
  const [orderStatus, setOrderStatus] = useState<string | null>(currentOrderStatus ? currentOrderStatus.toLowerCase() : null)
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [amount, setAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Set up real-time subscription for invoice changes
  useEffect(() => {
    if (!selectedId || !invoice) return

    console.log(`[PaymentRequestPanel] Setting up real-time subscription for invoice ${invoice.id}`)

    // Subscribe to changes on this specific invoice
    const channel = supabase
      .channel(`invoice:${invoice.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices',
          filter: `id=eq.${invoice.id}`
        },
        (payload) => {
          console.log(`[PaymentRequestPanel] Invoice update received:`, payload)
          const updated = payload.new as InvoiceData
          if (updated.payment_status) {
            setInvoice((prev) =>
              prev ? { ...prev, payment_status: updated.payment_status, paid_at: updated.paid_at } : null
            )
          }
        }
      )
      .subscribe()

    subscriptionRef.current = channel

    return () => {
      console.log(`[PaymentRequestPanel] Unsubscribing from invoice ${invoice.id}`)
      supabase.removeChannel(channel)
      subscriptionRef.current = null
    }
  }, [invoice?.id])

  // Initial load
  useEffect(() => {
    setShowForm(false)
    setAmount("")
    setInvoice(null)

    if (currentOrderStatus) {
      setOrderStatus(currentOrderStatus.toLowerCase())
    }

    if (!selectedId) return

    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const { data: wo } = await supabase
          .from("work_orders")
          .select("status")
          .eq("id", selectedId)
          .maybeSingle()
        if (!mounted) return
        setOrderStatus((wo?.status || null)?.toString().toLowerCase() ?? null)

        const { data: inv } = await supabase
          .from("invoices")
          .select("id, payment_status, paid_at")
          .eq("work_order_id", selectedId)
          .eq("invoice_type", "service")
          .maybeSingle()
        if (!mounted) return
        setInvoice(inv ?? null)
      } catch (e) {
        console.error("PaymentRequestPanel load error", e)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [selectedId, currentOrderStatus])

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
            <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            <span className="px-2 py-1 rounded text-blue-700 bg-blue-50 border border-blue-100">Live Updates</span>
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
              <div className="font-semibold text-green-800">✅ Payment Completed</div>
              {invoice?.paid_at && (
                <div className="text-sm text-green-700">Paid on {new Date(invoice.paid_at).toLocaleDateString()}</div>
              )}
            </div>
          </div>
        ) : invoiceExists ? (
          <div className="border border-blue-200 bg-blue-50 rounded-md p-4">
            <div className="font-medium text-blue-800 flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              Awaiting Payment
            </div>
            <div className="text-sm text-gray-600 mt-1">Real-time monitoring active</div>
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
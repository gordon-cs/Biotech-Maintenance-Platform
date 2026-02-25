"use client"

import React, { useEffect, useState, Suspense, useMemo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import AddWorkOrderUpdate from "../../components/AddWorkOrderUpdate"
import EditWorkOrderModal from "../../components/EditWorkOrderModal"
import ConfirmationModal from "../../components/ConfirmationModal"

type DisplayRow = {
  id: string
  title: string
  address: string
  category: string
  description: string
  created_at: string
  urgency?: string
  status?: string
  labName?: string
  date?: string | null
  claimedBy?: string
  equipment?: string | null
}

// shape returned by the server-side manager-work-orders route
type AssignedProfile = {
  id: string
  full_name?: string | null
  email?: string | null
}

type WorkOrderRow = {
  id: number
  title?: string | null
  equipment?: string | null
  description?: string | null
  category_id?: number | null
  lab: number
  created_at?: string | null
  urgency?: string | null
  status?: string | null
  date?: string | null
  assigned_to?: string | null
  assigned?: AssignedProfile[]
}

const formatDateTime = (dateString?: string | null) => {
  if (!dateString) return "N/A"
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return "Invalid date"
  
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
  return `${formattedDate} ${formattedTime}`
}

const getStatusBadgeStyle = (status?: string) => {
  switch (status?.toLowerCase()) {
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'in_progress':
    case 'in progress':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'canceled':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'open':
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

const formatStatus = (status?: string) => {
  if (!status) return 'Open'
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const urgencyOrder = { high: 3, medium: 2, low: 1, "": 0, "n/a": 0 } as const

const getUrgencyScore = (urgency?: string) => 
  urgencyOrder[urgency?.toLowerCase() as keyof typeof urgencyOrder] ?? 0

const sortOrders = (ordersToSort: DisplayRow[], sortOrder: string) => {
  const sorted = [...ordersToSort]
  
  switch (sortOrder) {
    case "most_recent":
      return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    case "oldest_first":
      return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    case "by_priority":
      return sorted.sort((a, b) => getUrgencyScore(b.urgency) - getUrgencyScore(a.urgency))
    default:
      return sorted
  }
}

const canCancelOrder = (status?: string) => {
  const cancellableStatuses = ['open', 'pending', 'in_progress', 'claimed']
  return cancellableStatuses.includes(status?.toLowerCase() || 'open')
}

function PastOrdersContent() {
  const [orders, setOrders] = useState<DisplayRow[]>([])
  const [selectedOrder, setSelectedOrder] = useState<DisplayRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [locationFilter, setLocationFilter] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [sortOrder, setSortOrder] = useState("most_recent")
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null)
  const [paymentRequests, setPaymentRequests] = useState<Record<string, { id: number; payment_status: string; total_amount: number }>>({})
  const [isApprovingPayment, setIsApprovingPayment] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    orderId: string | null
    orderTitle: string
  }>({
    isOpen: false,
    orderId: null,
    orderTitle: "",
  })
  
  const searchParams = useSearchParams()
  const selectedOrderId = searchParams.get("selected")

  // Set page title
  useEffect(() => {
    document.title = "Past Orders | Biotech Maintenance"
  }, [])

  const handleCancelOrder = async (orderId: string, orderTitle: string) => {
    setConfirmModal({
      isOpen: true,
      orderId,
      orderTitle,
    })
  }

  const handleConfirmCancel = async () => {
    const orderId = confirmModal.orderId
    const orderTitle = confirmModal.orderTitle

    if (!orderId) return

    setCancellingOrderId(orderId)
    
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser()
      if (authErr) throw authErr
      const userId = authData?.user?.id
      if (!userId) throw new Error("Not authenticated")

      const { data: labs, error: labsError } = await supabase
        .from("labs")
        .select("id")
        .eq("manager_id", userId)

      if (labsError) throw labsError
      const labIds = labs?.map(lab => lab.id) || []

      const orderIdNumber = parseInt(orderId, 10)
      if (isNaN(orderIdNumber)) {
        throw new Error("Invalid order ID")
      }

      const { data: existingOrder, error: checkError } = await supabase
        .from("work_orders")
        .select("id, status, lab")
        .eq("id", orderIdNumber)
        .single()
      
      if (checkError) {
        throw new Error("Order not found")
      }

      if (!labIds.includes(existingOrder.lab)) {
        throw new Error("You don't have permission to cancel this order")
      }

      const { error: updateError } = await supabase
        .from("work_orders")
        .update({ status: "canceled" })
        .eq("id", orderIdNumber)
        .select()
      
      if (updateError) {
        throw updateError
      }
      
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId
            ? { ...order, status: "canceled" }
            : order
        )
      )
      
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: "canceled" } : null)
      }
      
      alert("Order canceled successfully")
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred"
      alert("Failed to cancel order: " + errorMessage)
    } finally {
      setCancellingOrderId(null)
      setConfirmModal({ isOpen: false, orderId: null, orderTitle: "" })
    }
  }

  const handleCloseModal = () => {
    setConfirmModal({ isOpen: false, orderId: null, orderTitle: "" })
  }

  const loadPaymentRequests = async () => {
    try {
      const { data } = await supabase
        .from('invoices')
        .select('*')
        .in('work_order_id', orders.map(o => parseInt(o.id)))
      
      if (data) {
        const requestsMap: Record<string, { id: number; payment_status: string; total_amount: number }> = {}
        data.forEach(invoice => {
          requestsMap[invoice.work_order_id] = invoice
        })
        setPaymentRequests(requestsMap)
      }
    } catch (err) {
    }
  }

  const handleApprovePayment = async (workOrderId: string, invoiceId: number) => {
    setIsApprovingPayment(workOrderId)
    
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
        body: JSON.stringify({ invoiceId: invoiceId })
      })

      if (response.ok) {
        alert('Payment approved and sent to Bill.com!')
        loadPaymentRequests() // Reload to update status
      } else {
        const error = await response.json()
        alert(`Failed to approve payment: ${error.error}`)
      }
    } catch (error) {
      alert('Failed to approve payment')
    } finally {
      setIsApprovingPayment(null)
    }
  }

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser()
        if (authErr) throw authErr
        const userId = authData?.user?.id
        if (!userId) {
          setError("Not authenticated")
          return
        }

        const labsRes = await supabase
          .from("labs")
          .select("id, name, address, address2, city, state, zipcode")
          .eq("manager_id", userId)
        
        if (labsRes.error) throw labsRes.error
        const labRows = labsRes.data || []
        const labIds = labRows.map((r) => r.id)

        if (labIds.length === 0) {
          if (mounted) setOrders([])
          return
        }

        // get the current session to authorize the manager-work-orders request
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session?.access_token) {
          setError("Not authenticated")
          return
        }

        // ask server route that uses service role to join assigned profile
        const mgrResp = await fetch("/api/manager-work-orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ labIds })
        })
        // debug: log status and body when non-ok
        if (!mgrResp.ok) {
          const text = await mgrResp.text().catch(() => "<no body>")
          // eslint-disable-next-line no-console
          console.error("manager-work-orders failed", mgrResp.status, mgrResp.statusText, text)
          // Throw a generic error to avoid leaking internal response details to the UI
          throw new Error(`Failed fetching manager work orders: ${mgrResp.status} ${mgrResp.statusText}`)
        }
        const mgrJson = await mgrResp.json()
        const woRows = (mgrJson.data || []) as WorkOrderRow[]

        // collect numeric category ids (type guard removes null/undefined)
        const catIds = Array.from(
          new Set(woRows.map(w => w.category_id).filter((v): v is number => v !== null && v !== undefined))
        )
         const categoryMap: Record<number, string> = {}
         if (catIds.length) {
           const catRes = await supabase.from("categories").select("id, name").in("id", catIds)
           if (!catRes.error) {
             for (const c of catRes.data || []) {
               categoryMap[c.id] = c.name || "N/A"
             }
           }
         }

        const labMap: Record<number, string> = {}
        const labNameMap: Record<number, string> = {}
        for (const l of labRows) {
          const parts = [l.address, l.address2, l.city, l.state, l.zipcode].filter(Boolean)
          labMap[l.id] = parts.length ? parts.join(", ") : "N/A"
          labNameMap[l.id] = l.name || "Unknown Lab"
        }

        const display: DisplayRow[] = woRows.map((r: WorkOrderRow) => ({
            id: String(r.id),
            title: r.title || "Untitled",
            address: labMap[r.lab] || "N/A",
            category: (r.category_id !== null && r.category_id !== undefined)
             ? (categoryMap[r.category_id] ?? "N/A")
             : "N/A",
            description: r.description || "No description available",
            created_at: r.created_at || "",
            urgency: r.urgency || undefined,
            status: r.status || "Open",
            labName: labNameMap[r.lab] || "Unknown Lab",
            date: r.date ?? null,
            claimedBy: r.assigned && r.assigned.length
              ? (r.assigned[0].full_name || r.assigned[0].email || String(r.assigned[0].id))
              : undefined,
           equipment: r.equipment ?? null
           }))

        if (mounted) {
          setOrders(display)
          if (display.length > 0) {
            setSelectedOrder(display[0])
          }
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!selectedOrderId || orders.length === 0) return
    const target = orders.find(o => o.id === selectedOrderId)
    if (target) {
      setSelectedOrder(target)
    }
  }, [selectedOrderId, orders])

  const filteredOrders = useMemo(() => {
    let filtered = orders
    
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      filtered = filtered.filter(order => 
        order.title.toLowerCase().includes(q) ||
        order.description.toLowerCase().includes(q)
      )
    }
    
    if (locationFilter) {
      filtered = filtered.filter(order => order.address.includes(locationFilter))
    }
    
    if (categoryFilter) {
      filtered = filtered.filter(order => order.category === categoryFilter)
    }
    
    return sortOrders(filtered, sortOrder)
  }, [orders, searchTerm, locationFilter, categoryFilter, sortOrder])

  useEffect(() => {
    if (orders.length > 0) {
      loadPaymentRequests()
    }
  }, [orders])

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <div className="max-w-7xl mx-auto p-6">
        {/* Search and Filters */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search Request"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2.5 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="absolute right-3 top-2.5">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            
            <select
              value={categoryFilter} 
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2.5 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Categories</option>
              {Array.from(new Set(orders.map(o => o.category))).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-gray-600">Results</span>
              <select 
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="px-3 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="most_recent">Most Recent</option>
                <option value="oldest_first">Oldest First</option>
                <option value="by_priority">By Priority</option>
              </select>
            </div>

            <div className="h-[calc(100vh-400px)] min-h-[400px] max-h-[600px] overflow-y-auto border border-gray-200 rounded-lg bg-white p-2">
              <div className="space-y-3">
                {loading && <div className="text-center py-4">Loading...</div>}
                {error && <div className="text-red-600 py-4">Error: {error}</div>}
                
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors relative ${
                      selectedOrder?.id === order.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="absolute top-2 right-2 flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded border font-medium ${getStatusBadgeStyle(order.status || '')}`}>
                        {formatStatus(order.status || '')}
                      </span>
                      {canCancelOrder(order.status || '') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCancelOrder(order.id, order.title)
                          }}
                          disabled={cancellingOrderId === order.id}
                          className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Cancel Order"
                        >
                          {cancellingOrderId === order.id ? "..." : "Cancel"}
                        </button>
                      )}
                    </div>

                    <div 
                      onClick={() => setSelectedOrder(order)}
                      className="flex items-start gap-3 pr-24"
                    >
                      <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500 mb-1">{order.labName}</div>
                        <div className="font-medium text-sm mb-1">{order.title}</div>
                        <div className="text-xs text-gray-500 mb-1">{order.address}</div>
                        <div className="text-xs text-gray-400">{order.category}</div>
                        {order.urgency && (
                          <div className={`text-xs mt-1 px-2 py-1 rounded inline-block ${
                            order.urgency?.toLowerCase() === "high" ? "bg-red-100 text-red-800" :
                            order.urgency?.toLowerCase() === "medium" ? "bg-yellow-100 text-yellow-800" :
                            order.urgency?.toLowerCase() === "low" ? "bg-green-100 text-green-800" :
                            "bg-gray-100 text-gray-800"
                          }`}>
                            {order.urgency}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {!loading && !error && filteredOrders.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No orders found
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-8">
            {selectedOrder ? (
              <div className="border rounded-lg p-6 bg-white">
                <div className="mb-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="text-sm text-gray-500 mb-1">{selectedOrder.labName}</div>
                      <h2 className="text-xl font-semibold">{selectedOrder.title}</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 text-sm rounded-full border font-medium ${getStatusBadgeStyle(selectedOrder.status || '')}`}>
                        {formatStatus(selectedOrder.status || '')}
                      </span>
                      
                      <div className="flex gap-2">
                        {canCancelOrder(selectedOrder.status || '') && (
                          <button
                            onClick={() => handleCancelOrder(selectedOrder.id, selectedOrder.title)}
                            disabled={cancellingOrderId === selectedOrder.id}
                            className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {cancellingOrderId === selectedOrder.id ? "Canceling..." : "Cancel Order"}
                          </button>
                        )}
                        {["open", "claimed"].includes((selectedOrder.status || "").toLowerCase()) && (
                          <button
                            onClick={() => setEditOpen(true)}
                            className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-500 mb-1">
                    Submitted on {formatDateTime(selectedOrder.created_at)}
                  </div>
                  <div className="text-sm text-gray-500 mb-2">Due Date: {formatDateTime(selectedOrder.date)}</div>
                  {(selectedOrder.status?.toLowerCase() === "claimed" || selectedOrder.status?.toLowerCase() === "completed") && selectedOrder.claimedBy && (
                    <div className="text-sm text-gray-700 mb-2">
                      Claimed by Technician: <span className="font-medium">{selectedOrder.claimedBy}</span>
                    </div>
                  )}
                  <div className="text-sm text-gray-500 mb-2">{selectedOrder.address}</div>
                  <div className="text-sm font-medium mb-2">Category: {selectedOrder.category}</div>
                  {selectedOrder.equipment && (
                    <div className="text-sm text-gray-700 mb-2">
                      <span className="font-medium">Equipment:</span> {selectedOrder.equipment}
                    </div>
                  )}
                 {selectedOrder.urgency && (
                    <div className={`inline-block text-sm px-3 py-1 rounded-full mb-4 ${
                      selectedOrder.urgency?.toLowerCase() === "critical" ? "bg-red-100 text-red-800" :
                    selectedOrder.urgency?.toLowerCase() === "high" ? "bg-orange-100 text-orange-800" :
                    selectedOrder.urgency?.toLowerCase() === "normal" ? "bg-yellow-100 text-yellow-800" :
                    selectedOrder.urgency?.toLowerCase() === "low" ? "bg-green-100 text-green-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
                    Priority: {selectedOrder.urgency}
                  </div>
                )}
                </div>

                <div className="mb-6">
                  <p className="text-gray-700 leading-relaxed">
                    {selectedOrder.description}
                  </p>
                </div>

                {/* Work Order Updates Section */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <AddWorkOrderUpdate 
                    workOrderId={Number(selectedOrder.id)} 
                    currentStatus={selectedOrder.status || "open"}
                  />
                </div>

                {/* Payment Request Section - NEWLY ADDED */}
                {selectedOrder.status === 'completed' && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <span>Payment Request</span>
                    </h3>

                    {paymentRequests[selectedOrder.id] ? (
                      <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-lg p-6">
                        {/* Payment Request Details */}
                        <div className="grid grid-cols-2 gap-6 mb-6">
                          <div>
                            <p className="text-sm text-gray-600 mb-2">Requested Amount</p>
                            <p className="text-4xl font-bold text-gray-900">
                              ${paymentRequests[selectedOrder.id]?.total_amount 
                                ? Number(paymentRequests[selectedOrder.id].total_amount).toFixed(2) 
                                : '0.00'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600 mb-2">Status</p>
                            <span className={`px-4 py-2 rounded-full text-sm font-medium inline-flex items-center gap-2 ${
                              paymentRequests[selectedOrder.id]?.payment_status === 'unbilled' 
                                ? 'bg-orange-100 text-orange-800'
                                : paymentRequests[selectedOrder.id]?.payment_status === 'awaiting_payment'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {paymentRequests[selectedOrder.id]?.payment_status === 'unbilled' && '⏳ Payment Requested'}
                              {paymentRequests[selectedOrder.id]?.payment_status === 'awaiting_payment' && '📤 Awaiting Payment'}
                              {paymentRequests[selectedOrder.id]?.payment_status === 'paid' && '✓ Paid'}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons - Only show if unbilled */}
                        {paymentRequests[selectedOrder.id]?.payment_status === 'unbilled' && (
                          <button
                            onClick={() => handleApprovePayment(selectedOrder.id, paymentRequests[selectedOrder.id].id)}
                            disabled={isApprovingPayment === selectedOrder.id}
                            className="w-full bg-green-600 text-white py-4 px-6 rounded-lg font-bold text-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isApprovingPayment === selectedOrder.id 
                              ? '⏳ Processing Payment...' 
                              : '✓ Approve & Pay via Bill.com'}
                          </button>
                        )}

                        {/* Awaiting Payment Message */}
                        {paymentRequests[selectedOrder.id]?.payment_status === 'awaiting_payment' && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <div className="flex items-center">
                              <span className="text-2xl mr-3">📤</span>
                              <div>
                                <p className="font-semibold text-yellow-900">Payment in Progress</p>
                                <p className="text-sm text-yellow-700">
                                  Invoice sent to Bill.com. Payment is being processed.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Paid Message */}
                        {paymentRequests[selectedOrder.id]?.payment_status === 'paid' && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center">
                              <span className="text-2xl mr-3">✓</span>
                              <div>
                                <p className="font-semibold text-green-900">Payment Completed</p>
                                <p className="text-sm text-green-700">
                                  Payment has been successfully processed through Bill.com
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6 text-center">
                        <p className="text-gray-500">No payment request for this work order</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="border rounded-lg p-6 bg-white text-center text-gray-500">
                Select an order to view details
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 right-6">
        <Link 
          href="/manager" 
          className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      { /* render modal */ }
      <EditWorkOrderModal
         open={editOpen}
         onClose={() => setEditOpen(false)}
         workOrder={{
           id: selectedOrder?.id ?? "",
           title: selectedOrder?.title ?? "",
           description: selectedOrder?.description ?? "",
           date: selectedOrder?.date ?? null,
           urgency: selectedOrder?.urgency ?? null,
           equipment: selectedOrder?.equipment ?? null
         }}
         onSaved={async (updated) => {
          // normalize incoming values
          const updatedId = String(updated.id)
          const normalizedTitle = updated.title ?? ""
          const normalizedDescription = updated.description ?? ""
          const normalizedDate = updated.date ?? null
          const normalizedUrgency = typeof updated.urgency === "string" ? updated.urgency : undefined
          const normalizedEquipment = updated.equipment ?? null

          // resolve category name if category_id was returned
          let normalizedCategory = selectedOrder?.category ?? "N/A"
          if (typeof updated.category_id === "number") {
            const { data: catData, error: catErr } = await supabase
              .from("categories")
              .select("name")
              .eq("id", updated.category_id)
              .maybeSingle()
            if (!catErr && catData && typeof catData.name === "string") {
              normalizedCategory = catData.name
            } else {
              normalizedCategory = "N/A"
            }
          }

          // resolve address string if address_id was returned
          let normalizedAddress = selectedOrder?.address ?? "N/A"
          if (typeof updated.address_id === "number") {
            const { data: addrData, error: addrErr } = await supabase
              .from("addresses")
              .select("line1, city, state, zipcode")
              .eq("id", updated.address_id)
              .maybeSingle()
            if (!addrErr && addrData) {
              const parts = [addrData.line1, addrData.city, addrData.state, addrData.zipcode].filter(Boolean)
              normalizedAddress = parts.length ? parts.join(", ") : "N/A"
            } else {
              normalizedAddress = "N/A"
            }
          }

          // update orders list
          setOrders(prev =>
            prev.map(o =>
              o.id === updatedId
                ? {
                    ...o,
                    title: normalizedTitle,
                    description: normalizedDescription,
                    date: normalizedDate,
                    urgency: normalizedUrgency,
                    equipment: normalizedEquipment,
                    category: normalizedCategory,
                    address: normalizedAddress,
                  }
                : o
            )
          )

          // update selectedOrder detail if it matches
          if (selectedOrder?.id === updatedId) {
            setSelectedOrder(prev =>
              prev
                ? {
                    ...prev,
                    title: normalizedTitle,
                    description: normalizedDescription,
                    date: normalizedDate,
                    urgency: normalizedUrgency,
                    equipment: normalizedEquipment,
                    category: normalizedCategory,
                    address: normalizedAddress,
                  }
                : prev
            )
          }
        }}
      {/* Confirmation Modal for Canceling Work Order */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title="Cancel this work order?"
        message={`Are you sure you want to cancel "${confirmModal.orderTitle}"? This will mark it as canceled but preserve the record.`}
        confirmText="Cancel Order"
        backText="Keep Order"
        onConfirm={handleConfirmCancel}
        onClose={handleCloseModal}
        isDangerous={true}
      />
    </div>
  )
}

export default function PastOrdersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading past orders...</p>
        </div>
      </div>
    }>
      <PastOrdersContent />
    </Suspense>
  )
}
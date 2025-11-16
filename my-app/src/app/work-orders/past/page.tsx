"use client"

import React, { useEffect, useState, Suspense, useMemo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

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
}

const formatDateTime = (dateString?: string) => {
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
    case 'cancelled':
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

function PastOrdersContent() {
  const [orders, setOrders] = useState<DisplayRow[]>([])
  const [selectedOrder, setSelectedOrder] = useState<DisplayRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [locationFilter, setLocationFilter] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [sortOrder, setSortOrder] = useState("most_recent")
  
  const searchParams = useSearchParams()
  const selectedOrderId = searchParams.get("selected")

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

        const ordersRes = await supabase
          .from("work_orders")
          .select("id, title, description, category_id, lab, created_at, urgency, status")
          .in("lab", labIds)
          .order("created_at", { ascending: false })

        if (ordersRes.error) throw ordersRes.error
        const woRows = ordersRes.data || []

        const catIds = Array.from(new Set(woRows.map(w => w.category_id).filter(Boolean)))
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

        const display: DisplayRow[] = woRows.map(r => ({
          id: String(r.id),
          title: r.title || "Untitled",
          address: labMap[r.lab] || "N/A",
          category: categoryMap[r.category_id] || "N/A",
          description: r.description || "No description available",
          created_at: r.created_at || "",
          urgency: r.urgency || undefined,
          status: r.status || "Open",
          labName: labNameMap[r.lab] || "Unknown Lab"
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

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Header */}
      <div className="bg-green-700 text-white p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-xl font-bold">B+B</div>
          <div className="flex gap-6">
            <span>Order</span>
            <span>About</span>
          </div>
          <div className="bg-gray-200 text-gray-700 px-3 py-1 rounded">User</div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">Past Orders</h1>
        </div>

        {/* Search and Filters */}
        <div className="bg-blue-100 border border-blue-300 rounded-lg p-4 mb-6">
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search Request"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="absolute right-3 top-2.5">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            
            <select 
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Location</option>
              {Array.from(new Set(orders.map(o => o.address))).map(addr => (
                <option key={addr} value={addr}>{addr}</option>
              ))}
            </select>

            <select
              value={categoryFilter} 
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Categories</option>
              {Array.from(new Set(orders.map(o => o.category))).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left Panel - Results List */}
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
                    onClick={() => setSelectedOrder(order)}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors relative ${
                      selectedOrder?.id === order.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* Status badge in top right */}
                    <div className="absolute top-2 right-2">
                      <span className={`px-2 py-1 text-xs rounded border font-medium ${getStatusBadgeStyle(order.status)}`}>
                        {formatStatus(order.status)}
                      </span>
                    </div>

                    <div className="flex items-start gap-3 pr-16">
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

          {/* Right Panel - Order Details */}
          <div className="col-span-8">
            {selectedOrder ? (
              <div className="border rounded-lg p-6 bg-white">
                <div className="mb-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="text-sm text-gray-500 mb-1">{selectedOrder.labName}</div>
                      <h2 className="text-xl font-semibold">{selectedOrder.title}</h2>
                    </div>
                    {/* Status badge in detail view */}
                    <div>
                      <span className={`px-3 py-1 text-sm rounded-full border font-medium ${getStatusBadgeStyle(selectedOrder.status)}`}>
                        {formatStatus(selectedOrder.status)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-500 mb-1">
                    Submitted on {formatDateTime(selectedOrder.created_at)}
                  </div>
                  <div className="text-sm text-gray-500 mb-2">{selectedOrder.address}</div>
                  <div className="text-sm font-medium mb-2">Category: {selectedOrder.category}</div>
                  {selectedOrder.urgency && (
                    <div className={`inline-block text-sm px-3 py-1 rounded-full ${
                      selectedOrder.urgency?.toLowerCase() === "high" ? "bg-red-100 text-red-800" :
                      selectedOrder.urgency?.toLowerCase() === "medium" ? "bg-yellow-100 text-yellow-800" :
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
              </div>
            ) : (
              <div className="border rounded-lg p-6 bg-white text-center text-gray-500">
                Select an order to view details
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Back to Dashboard Button - Fixed at bottom right */}
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
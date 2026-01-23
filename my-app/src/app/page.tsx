"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

import AddWorkOrderUpdate from "./components/AddWorkOrderUpdate"
import type { PostgrestResponse } from "@supabase/supabase-js"

type WO = {
  id: number
  created_by?: string | null
  lab?: number | null
  title?: string | null
  description?: string | null
  equipment?: string | null
  urgency?: string | null
  status?: string | null
  date?: string | null
  assigned_to?: string | null
  created_at?: string | null
  updated_at?: string | null
  category_id?: number | null
  address_id?: number | null
  // enrichment
  labName?: string | null
  categoryName?: string | null
  address?: string | null
  creatorEmail?: string | null
}

export default function Home() {
  const router = useRouter()

  // auth/role
  const [role, setRole] = useState<"lab" | "technician" | "admin" | null>(null)
  const [roleLoaded, setRoleLoaded] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // technician UI state
  const [search, setSearch] = useState("")
  const [labs, setLabs] = useState<Array<{ id: number; name: string }>>([])
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([])
  const [selectedLab, setSelectedLab] = useState<number | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<"recent" | "oldest">("recent")
  const [orders, setOrders] = useState<WO[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [serviceArea, setServiceArea] = useState("")
  const [category, setCategory] = useState("")
  const [categoriesList, setCategoriesList] = useState<Array<{id:number, slug:string, name:string}>>([])
  const [date, setDate] = useState<string>("")
  const [activeTab, setActiveTab] = useState<"open" | "mine">("open")

  // Payment request state
  const [showPaymentRequest, setShowPaymentRequest] = useState(false)
  const [requestedAmount, setRequestedAmount] = useState("")
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)
  const [hasExistingRequest, setHasExistingRequest] = useState(false)
  const [paymentRequestStatus, setPaymentRequestStatus] = useState<{
    status: string | null
    paidAt: string | null
  }>({ status: null, paidAt: null })

  // Set page title based on role
  useEffect(() => {
    if (role === "technician") {
      document.title = "Technician Dashboard | Biotech Maintenance"
    } else if (role === "lab") {
      document.title = "Lab Dashboard | Biotech Maintenance"
    } else if (role === "admin") {
      document.title = "Admin Dashboard | Biotech Maintenance"
    } else {
      document.title = "Biotech Maintenance Platform"
    }
  }, [role])

  // Load role once and on auth changes
  useEffect(() => {
    let mounted = true
    
    const loadRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.user) {
          if (mounted) {
            setRoleLoaded(true)
            setIsLoggedIn(false)
          }
          return
        }
        
        if (mounted) {
          setCurrentUserId(session.user.id)
          setIsLoggedIn(true)
        }
        const userId = session.user.id
        
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle()
        
        if (!mounted) return
        
        if (!error && data) {
          const r = (data.role || "").toString().toLowerCase()
          const userRole =
            r === "technician" ? "technician" :
            r === "lab" ? "lab" :
            r === "admin" ? "admin" : null
          setRole(userRole)
          
          // Auto-redirect admin and lab users
          if (userRole === "admin") {
            setIsRedirecting(true)
            window.location.href = "/admin"
            return
          }
          if (userRole === "lab") {
            setIsRedirecting(true)
            window.location.href = "/manager"
            return
          }
        }
        
        if (mounted) setRoleLoaded(true)
      } catch (err) {
        if (mounted) setRoleLoaded(true)
      }
    }
    
    loadRole()
    
    // Listen for auth state changes
    const { data: sub } = supabase.auth.onAuthStateChange(() => { 
      loadRole() 
    })
    
    return () => {
      mounted = false
      try { sub?.subscription?.unsubscribe?.() } catch {}
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
  }
  // load labs, categories and work orders
  useEffect(() => {
    let mounted = true
    const load = async () => {
      // load labs and categories first (typed)
      type LabRow = { id: number; name: string }
      type CategoryRow = { id: number; name: string }
      const labsRes = (await supabase.from("labs").select("id,name")) as PostgrestResponse<LabRow>
      const catsRes = (await supabase.from("categories").select("id,name")) as PostgrestResponse<CategoryRow>

      if (!mounted) return

      const loadedLabs = (!labsRes.error && labsRes.data) ? labsRes.data : []
      const loadedCategories = (!catsRes.error && catsRes.data) ? catsRes.data : []
      
      setLabs(loadedLabs)
      setCategories(loadedCategories)

      console.log("Loaded categories for mapping:", loadedCategories)

      // then load work orders with the loaded data
      await loadWorkOrders(loadedLabs, loadedCategories)
    }
    load()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy])

  const loadWorkOrders = async (labsData?: Array<{id: number; name: string}>, categoriesData?: Array<{id: number; name: string}>) => {
    setLoading(true)
    setMessage(null)
    const { data, error } = await supabase
      .from("work_orders")
      .select("id,title,description,date,category_id,lab,created_by,status,created_at,address_id,assigned_to,urgency")
      .order("created_at", { ascending: sortBy === "oldest" })
    if (error) {
      setMessage(error.message)
      setOrders([])
      setLoading(false)
      return
    }

    // enrich with lab/category names (maps) — typed DB rows
    type WorkOrdersRow = {
      id: number | string
      title?: string | null
      description?: string | null
      date?: string | null
      category_id?: number | string | null
      lab?: number | string | null
      created_by?: string | null
      status?: string | null
      assigned_to?: string | null
      created_at?: string | null
      address_id?: number | string | null
      urgency?: string | null
    }

    // Use passed data if available, otherwise fall back to state
    const labsToUse = labsData || labs
    const categoriesToUse = categoriesData || categories

    const labsMap = new Map<number,string>()
    const catsMap = new Map<number,string>()
    labsToUse.forEach(l => labsMap.set(l.id, l.name))
    categoriesToUse.forEach(c => catsMap.set(c.id, c.name))
    
    console.log("Categories for mapping:", categoriesToUse)
    console.log("Categories map:", catsMap)

    // Fetch addresses for all work orders
    const raw = (data || []) as WorkOrdersRow[]
    const addressIds = raw.map(wo => wo.address_id).filter(Boolean) as number[]
    const addressMap = new Map<number, string>()
    
    if (addressIds.length > 0) {
      const { data: addressData } = await supabase
        .from("addresses")
        .select("id, line1, line2, city, state, zipcode")
        .in("id", addressIds)
      
      if (addressData) {
        addressData.forEach((addr) => {
          const parts = [addr.line1, addr.city, addr.state, addr.zipcode].filter(Boolean)
          addressMap.set(addr.id, parts.join(", "))
        })
      }
    }

    const enriched = raw.map((wo) => {
      const categoryId = wo.category_id != null ? Number(wo.category_id) : null
      const categoryName = categoryId ? catsMap.get(categoryId) ?? null : null
      console.log(`WO ${wo.id}: category_id=${wo.category_id}, categoryId=${categoryId}, categoryName=${categoryName}`)
      
      return {
        id: Number(wo.id),
        title: wo.title ?? null,
        description: wo.description ?? null,
        date: wo.date ?? null,
        category_id: categoryId,
        lab: wo.lab != null ? Number(wo.lab) : null,
        created_by: wo.created_by ?? null,
        status: wo.status ?? null,
        assigned_to: wo.assigned_to ?? null,
        created_at: wo.created_at ?? null,
        address_id: wo.address_id != null ? Number(wo.address_id) : null,
        address: wo.address_id ? addressMap.get(Number(wo.address_id)) ?? null : null,
        labName: wo.lab ? labsMap.get(Number(wo.lab)) ?? null : null,
        categoryName: categoryName,
        urgency: wo.urgency ?? null
      }
    }) as WO[]

    setOrders(enriched)
    if (!selectedId && enriched.length) setSelectedId(enriched[0].id)
    setLoading(false)
  }

  const acceptJob = async (woId: number | null) => {
    if (!woId) return
    setLoading(true)
    setMessage(null)

    // get current user id
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession()
    if (sessionError || !session?.user?.id) {
      setMessage("Unable to get session.")
      setLoading(false)
      return
    }
    const userId = session.user.id

    // update DB: set status to 'claimed' and assigned_to = userId
    const { data: updated, error } = await supabase
      .from("work_orders")
      .update({ status: "claimed", assigned_to: userId })
      .eq("id", woId)
      .select()
      .maybeSingle()

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    const { data: workOrder } = await supabase
      .from('work_orders')
      .select('lab, initial_fee')
      .eq('id', woId)
      .single()

    if (workOrder && workOrder.lab) {
      const initialFeeAmount = workOrder.initial_fee || 50.00
      
      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          work_order_id: woId,
          lab_id: workOrder.lab,
          created_by: userId,
          total_amount: initialFeeAmount,
          payment_status: 'unbilled',
          invoice_type: 'initial_fee'
        })
        .select()
        .single()

      if (invoiceError) {
        setMessage('Work order accepted, but failed to create initial fee invoice.')
      } else if (newInvoice) {
        try {
          const response = await fetch('/api/bill/create-invoice', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ invoiceId: newInvoice.id })
          })

          const result = await response.json()

          if (response.ok) {
            setSuccess('Work order accepted! Initial fee invoice sent and confirmation email delivered.')
          } else {
            setMessage(`Work order accepted, but failed to send initial fee invoice: ${result.error}`)
          }
        } catch (error) {
          setMessage('Work order accepted, but failed to send initial fee invoice to Bill.com.')
        }
      }
    } else {
      setMessage('Work order accepted, but no lab assigned to create invoice.')
    }

    setOrders((prev) =>
      prev.map((o) => (o.id === woId ? { ...o, status: "claimed", assigned_to: userId } : o))
    )
    
    if (selectedId === woId) {
      setSelectedId(woId)
    }

    setLoading(false)
  }

  const cancelJob = async (woId: number | null) => {
    if (!woId) return
    setLoading(true)
    setMessage(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) {
      setMessage("Unable to get session.")
      setLoading(false)
      return
    }

    // update DB: set status back to 'open' and assigned_to = null
    const { data: updated, error } = await supabase
      .from("work_orders")
      .update({ status: "open", assigned_to: null })
      .eq("id", woId)
      .select()
      .maybeSingle()

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setOrders((prev) =>
      prev.map((o) => (o.id === woId ? { ...o, status: "open", assigned_to: null } : o))
    )
    if (selectedId === woId) setSelectedId(woId)
    setLoading(false)
  }

  const checkExistingPaymentRequest = async (woId: number) => {
    // Check for SERVICE invoice only (not initial_fee invoice)
    const { data } = await supabase
      .from('invoices')
      .select('id, payment_status, paid_at')
      .eq('work_order_id', woId)
      .eq('invoice_type', 'service')
      .maybeSingle()
    
    if (data) {
      setPaymentRequestStatus({
        status: data.payment_status || null,
        paidAt: data.paid_at
      })
      setHasExistingRequest(true)
    } else {
      setPaymentRequestStatus({ status: null, paidAt: null })
      setHasExistingRequest(false)
    }
  }

  // Call checkExistingPaymentRequest whenever selectedId changes
  useEffect(() => {
    if (selectedId != null) {
      checkExistingPaymentRequest(selectedId)
    } else {
      setPaymentRequestStatus({ status: null, paidAt: null })
      setHasExistingRequest(false)
    }
  }, [selectedId])

  // handle new payment request
  const handlePaymentRequest = async (woId: number) => {
    setIsSubmittingPayment(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Please login first')
        return
      }

      const wo = orders.find(o => o.id === woId)
      if (!wo) {
        alert('Work order not found')
        return
      }

      // Create SERVICE invoice (initial fee invoice was created when technician accepted the job)
      const { error } = await supabase
        .from('invoices')
        .insert({
          work_order_id: woId,
          lab_id: wo.lab,
          created_by: user.id,
          total_amount: parseFloat(requestedAmount),
          payment_status: 'unbilled',
          invoice_type: 'service'
        })

      if (error) {
        alert('Failed to submit payment request: ' + error.message)
        return
      }

      alert('💰 Payment request submitted successfully!')
      setHasExistingRequest(true)
      setShowPaymentRequest(false)
      loadWorkOrders() // Refresh the list

    } catch (error) {
      alert('Failed to submit payment request')
    } finally {
      setIsSubmittingPayment(false)
    }
  }


  // derived lists: first filter by active tab, then by search/filters
  const tabFiltered = orders.filter((o) => {
    if (activeTab === "open") {
      // Open Requests: status === "open" and not assigned
      return (o.status || "").toLowerCase() === "open" && !o.assigned_to
    }
    // My Work Orders: assigned to current user
    return currentUserId ? o.assigned_to === currentUserId : false
  })

  const filteredOrders = tabFiltered.filter((o) => {
    if (search) {
      const hay = ((o.title || "") + " " + (o.description || "") + " " + (o.labName || "")).toLowerCase()
      if (!hay.includes(search.toLowerCase())) return false
    }
    if (selectedLab && o.lab !== selectedLab) return false
    if (selectedCategory && o.category_id !== selectedCategory) return false
    return true
  })

  // ensure selectedId points to a visible item when filters/tabs change
  useEffect(() => {
    if (!filteredOrders.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !filteredOrders.find((f) => f.id === selectedId)) {
      setSelectedId(filteredOrders[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, orders, search, selectedLab, selectedCategory])

  const selectedOrder = orders.find((o) => o.id === selectedId) ?? (filteredOrders[0] ?? null)

  // wait for role load
  if (!roleLoaded) return null

  // Technician view (top header kept identical)
  if (role === "technician") {
    return (
      <div className="font-sans min-h-screen p-8 bg-gray-50 text-black">
        <main className="max-w-7xl mx-auto">
          {/* Tabs */}
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={() => setActiveTab("open")}
              className={`px-4 py-2 rounded-full ${activeTab === "open" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700"}`}
            >
              Open Requests
            </button>
            <button
              onClick={() => setActiveTab("mine")}
              className={`px-4 py-2 rounded-full ${activeTab === "mine" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700"}`}
            >
              My Work Orders
            </button>
          </div>

          {/* Filter bar */}
           <section className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex gap-4 items-center">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Search Request"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full px-4 py-2.5 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="absolute right-3 top-2.5">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                
                <select
                  value={selectedCategory ?? ""}
                  onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : null)}
                  className="px-4 py-2.5 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Content two-column: list | detail */}
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-4">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-gray-600">Results</span>
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value === "oldest" ? "oldest" : "recent")}
                    className="px-3 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="recent">Most Recent</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>
                <div className="h-[calc(100vh-400px)] min-h-[400px] max-h-[600px] overflow-y-auto border border-gray-200 rounded-lg bg-white p-2">

                <div className="space-y-3">
                  {loading && <p className="text-sm text-gray-500 text-center py-4">Loading...</p>}
                  {!loading && filteredOrders.length === 0 && <p className="text-sm text-gray-500 text-center py-8">No requests found</p>}

                  {filteredOrders.map((wo) => (
                    <button
                      key={wo.id}
                      onClick={() => setSelectedId(wo.id)}
                      className={`w-full text-left p-3 border rounded-lg transition-colors relative ${
                        selectedId === wo.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      {/* Status badge in top right */}
                      <div className="absolute top-2 right-2">
                        <span className={`px-2 py-1 text-xs rounded border font-medium ${
                          wo.status?.toLowerCase() === "completed" ? "bg-green-100 text-green-800 border-green-200" :
                          wo.status?.toLowerCase() === "claimed" ? "bg-blue-100 text-blue-800 border-blue-200" :
                          "bg-gray-100 text-gray-800 border-gray-200"
                        }`}>
                          {wo.status?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "Open"}
                        </span>
                      </div>

                      <div className="flex items-start gap-3 pr-16">
                        <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm mb-1">{wo.title ?? "Title"}</div>
                          {wo.address && <div className="text-xs text-gray-500 mb-1">{wo.address}</div>}
                          <div className="text-xs text-gray-400">{wo.categoryName ?? "Category"}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Panel - Work Order Details */}
            <div className="col-span-8">
              <div className="border rounded-lg p-6 bg-white">
                {selectedOrder ? (
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-2xl font-bold mb-2">{selectedOrder.title}</h2>
                        <div>
                          <span className={`px-3 py-1 text-sm rounded-full border font-medium ${
                            selectedOrder.status?.toLowerCase() === "completed" ? "bg-green-100 text-green-800 border-green-200" :
                            selectedOrder.status?.toLowerCase() === "claimed" ? "bg-blue-100 text-blue-800 border-blue-200" :
                            "bg-gray-100 text-gray-800 border-gray-200"
                          }`}>
                            {selectedOrder.status?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "Open"}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-500 mb-1">
                      Submitted on {selectedOrder.created_at}
                    </div>
                    <div className="text-sm text-gray-500 mb-2">{selectedOrder.address || "No address"}</div>
                    <div className="text-sm font-medium mb-2">Category: {selectedOrder.categoryName || "N/A"}</div>
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

                    <div className="mb-6">
                      <p className="text-gray-700 leading-relaxed">{selectedOrder.description}</p>
                    </div>

      {/* Work Order Updates Section - Only show for claimed/in-progress work orders */}
                      {selectedOrder.id && selectedOrder.status?.toLowerCase() !== "open" && (
                        <div className="mt-6 pt-6 border-t border-gray-200">
                          <AddWorkOrderUpdate 
                            workOrderId={selectedOrder.id} 
                            currentStatus={selectedOrder.status || "open"}
                            userRole={role}
                            onStatusChange={(newStatus) => {
                              // Update local state when status changes to "completed"
                              if (newStatus === "completed") {
                                // Update the orders list
                                setOrders((prev) =>
                                  prev.map((o) => (o.id === selectedOrder.id ? { ...o, status: "completed" } : o))
                                )
                                // Update selected order display
                                // This will trigger the useEffect that checks for existing payment requests
                              }
                            }}
                          />
                        </div>
                      )}

                    {/* Payment Request Section - ONLY show on My Work Orders tab AND when completed */}
                    {activeTab === "mine" && selectedOrder?.status === "completed" && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-semibold">💰 Payment Request</h3>
                          {hasExistingRequest ? (
                            <span className="text-sm text-green-600 font-medium">✓ Request Sent</span>
                          ) : (
                            <button
                              onClick={() => setShowPaymentRequest(true)}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              Request Payment
                            </button>
                          )}
                        </div>

                        {/* Payment request form */}
                        {showPaymentRequest && !hasExistingRequest && (
                          <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border-2 border-green-300">
                            <p className="text-sm text-gray-700 mb-3">
                              Submit a payment request for this completed work order. Enter the amount in USD.
                            </p>

                            <div className="flex gap-3 mb-4">
                              <div className="flex-1">
                                <div className="relative">
                                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 font-medium">$</span>
                                  </div>
                                  <input
                                    type="number"
                                    value={requestedAmount}
                                    onChange={(e) => setRequestedAmount(e.target.value)}
                                    className="pl-8 w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                  />
                                </div>
                              </div>

                              <button
                                onClick={() => handlePaymentRequest(selectedOrder.id)}
                                disabled={isSubmittingPayment || !requestedAmount || parseFloat(requestedAmount) <= 0}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                              >
                                {isSubmittingPayment ? "Submitting..." : "Submit"}
                              </button>
                            </div>

                            <button
                              onClick={() => setShowPaymentRequest(false)}
                              className="text-sm text-gray-600 hover:text-gray-800 underline"
                            >
                              Cancel
                            </button>
                          </div>
                        )}

                        {/* Already submitted message */}
                        {hasExistingRequest && (
                          <div className={`p-4 rounded-lg border-2 ${
                            paymentRequestStatus.status === 'paid' 
                              ? 'bg-green-50 border-green-300' 
                              : paymentRequestStatus.status === 'awaiting_payment'
                              ? 'bg-yellow-50 border-yellow-300'
                              : 'bg-blue-50 border-blue-300'
                          }`}>
                            <div className="flex items-center">
                              <span className="text-2xl mr-3">
                                {paymentRequestStatus.status === 'paid' ? '✅' : '📧'}
                              </span>
                              <div>
                                {paymentRequestStatus.status === 'paid' ? (
                                  <>
                                    <p className="font-semibold text-green-900">Payment Completed</p>
                                    <p className="text-sm text-green-700 mt-1">
                                      Paid on {new Date(paymentRequestStatus.paidAt!).toLocaleDateString()}
                                    </p>
                                  </>
                                ) : paymentRequestStatus.status === 'awaiting_payment' ? (
                                  <>
                                    <p className="font-semibold text-yellow-900">Invoice Sent to Lab Manager</p>
                                    <p className="text-sm text-yellow-700 mt-1">
                                      Payment link emailed. Waiting for lab manager to pay via Bill.com.
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p className="font-semibold text-blue-900">Payment Request Submitted</p>
                                    <p className="text-sm text-blue-700 mt-1">Your request is pending manager approval</p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons - Only show for open/available jobs or to cancel claimed jobs */}
                    {activeTab === "open" && selectedOrder?.status === "open" && (
                      <div className="mt-6 pt-6 border-t border-gray-200 flex gap-3">
                        <button
                          onClick={() => acceptJob(selectedOrder?.id ?? null)}
                          disabled={loading || !selectedOrder}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          Accept Job
                        </button>
                      </div>
                    )}

                    {activeTab === "mine" && selectedOrder?.status === "claimed" && selectedOrder?.assigned_to === currentUserId && (
                      <div className="mt-6 pt-6 border-t border-gray-200 flex gap-3">
                        <button
                          onClick={() => cancelJob(selectedOrder?.id ?? null)}
                          disabled={loading}
                          className="px-4 py-2 bg-red-600 text-white border border-red-700 rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          Cancel Job
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    Select an order to view details
                  </div>
                )}  
              </div>
            </div>
          </div>
          </section>
        </main>
      </div>
    )
  }              
  // Show loading while checking role or redirecting
  if (!roleLoaded || isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isRedirecting ? "Redirecting to manager dashboard..." : "Loading..."}
          </p>
        </div>
      </div>
    )
  }

  // This should never show for lab users due to redirect above
  if (role === "lab") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to manager dashboard...</p>
          <button 
            onClick={() => window.location.href = "/manager"}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Click here if not redirected automatically
          </button>
        </div>
      </div>
    )
  }
  // Show "Complete Profile" for logged-in users without a role
  if (isLoggedIn && !role) {
    return (
      <div className="font-sans min-h-screen p-8 bg-gray-50 text-black">
        <main className="max-w-3xl mx-auto">
          <section className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <div className="mb-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Biotech Maintenance!</h1>
              <p className="text-gray-600">
                Please complete your profile to get started
              </p>
            </div>
            
            <button
              onClick={() => router.push("/complete-profile")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Complete Profile
            </button>
          </section>
        </main>
      </div>
    )
  }

  // Default view for non-logged-in users
  return (
    <div className="font-sans min-h-screen p-8 bg-gray-50 text-black">
      <main className="max-w-3xl mx-auto">
        <section>
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Biotech Maintenance Platform</h1>
              <p className="text-gray-600">
                Please sign in to access the platform
              </p>
            </div>
            
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => router.push("/signin")}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => router.push("/signup")}
                className="px-6 py-3 bg-white hover:bg-gray-50 text-green-600 border-2 border-green-600 rounded-lg font-semibold transition-colors"
              >
                Create Account
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

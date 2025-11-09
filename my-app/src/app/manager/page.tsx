"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"
import AuthStatus from "../components/AuthStatus"

type Category = { id: number; slug: string; name: string }
type WorkOrder = {
  id: string
  title: string
  category: string
  created_at: string
  status?: string
}

export default function ManagerDashboard() {
  const router = useRouter()
  const [serviceArea, setServiceArea] = useState("")
  const [date, setDate] = useState<string>("")
  const [category, setCategory] = useState("")
  const [categories, setCategories] = useState<Category[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const loadData = async () => {
      // Load categories
      const { data: catData, error: catError } = await supabase.from("categories").select("id,slug,name")
      if (!catError && catData && mounted) setCategories(catData as Category[])

      // Load recent work orders for current user
      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser()
        if (authErr || !authData?.user?.id) return

        const userId = authData.user.id

        // Get labs managed by user
        const labsRes = await supabase
          .from("labs")
          .select("id")
          .eq("manager_id", userId)
        
        if (labsRes.error || !labsRes.data) return
        const labIds = labsRes.data.map((l) => l.id)

        if (labIds.length === 0) return

        // Fetch recent work orders with status
        const ordersRes = await supabase
          .from("work_orders")
          .select("id, title, category_id, created_at, status")
          .in("lab", labIds)
          .order("created_at", { ascending: false })
          .limit(4)

        if (ordersRes.error || !ordersRes.data) return

        // Get category names
        const catIds = Array.from(new Set(ordersRes.data.map(w => w.category_id).filter(Boolean)))
        const categoryMap: Record<number, string> = {}
        if (catIds.length && catData) {
          for (const c of catData) {
            categoryMap[c.id] = c.name || "N/A"
          }
        }

        const orders: WorkOrder[] = ordersRes.data.map(r => ({
          id: String(r.id),
          title: r.title || "Untitled",
          category: categoryMap[r.category_id] || "N/A",
          created_at: r.created_at || "",
          status: r.status || "Open"
        }))

        if (mounted) setWorkOrders(orders)
      } catch (error) {
        console.error("Error loading work orders:", error)
      }
    }

    loadData()
    return () => { mounted = false }
  }, [])

  // Function to get status badge styling
  const getStatusBadgeStyle = (status: string) => {
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

  // Function to format status text
  const formatStatus = (status: string) => {
    if (!status) return 'Open'
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  // navigate to the dedicated submission page with pre-filled query params
  const handleNavigateToSubmission = (e?: React.FormEvent) => {
    e?.preventDefault()
    const params = new URLSearchParams()
    if (category) params.set("category", category)
    if (date) params.set("date", date)
    if (serviceArea) params.set("title", serviceArea)
    router.push(`/work-orders/submission?${params.toString()}`)
  }

  // Navigate to past orders page with specific order selected
  const handleViewOrderDetails = (orderId: string) => {
    router.push(`/work-orders/past?selected=${orderId}`)
  }

  return (
    <div className="min-h-screen p-8 bg-white text-black">
      <main className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Lab Manager Dashboard</h1>
          <AuthStatus />
        </header>

        <section className="bg-white rounded p-6 shadow mb-8">
          <h2 className="text-lg font-semibold mb-4">Quick Submit Work Order</h2>

          <form onSubmit={handleNavigateToSubmission} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Service Area</label>
              <input
                value={serviceArea}
                onChange={(e) => setServiceArea(e.target.value)}
                className="w-full border px-3 py-2 rounded"
                placeholder="Short title or service area"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <div className="text-sm mb-1">Date</div>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border px-3 py-2 rounded" />
              </label>

              <label className="block">
                <div className="text-sm mb-1">Category</div>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border px-3 py-2 rounded" required>
                  <option value="">Select…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button type="submit" disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded">
                {loading ? "Preparing..." : "Go to Submission"}
              </button>
            </div>

            {message && <div className="text-sm text-red-600 mt-2">{message}</div>}
            {success && <div className="text-sm text-green-600 mt-2">{success}</div>}
          </form>
        </section>

        {/* Work Orders Section */}
        <section className="bg-white rounded p-6 shadow">
          <h2 className="text-xl font-semibold text-center mb-6">Work Orders</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {workOrders.length > 0 ? (
              workOrders.map((order) => (
                <div key={order.id} className="border rounded-lg p-4 bg-gray-50 flex flex-col h-48 relative">
                  {/* Status badge in top right */}
                  <div className="absolute top-3 right-3">
                    <span className={`px-2 py-1 text-xs rounded border font-medium ${getStatusBadgeStyle(order.status || '')}`}>
                      {formatStatus(order.status || '')}
                    </span>
                  </div>
                  
                  <div className="mb-2 pr-20">
                    <div className="text-sm font-semibold">{order.title}</div>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1 mb-4 flex-grow">
                    <div>{new Date(order.created_at).toLocaleDateString()}</div>
                    <div>{order.category}</div>
                  </div>
                  <div className="mt-auto">
                    <button 
                      onClick={() => handleViewOrderDetails(order.id)}
                      className="w-full py-2 border border-gray-300 rounded text-sm hover:bg-gray-100 transition-colors"
                    >
                      View Order Details
                    </button>
                  </div>
                </div>
              ))
            ) : (
              // Show placeholder cards if no orders
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="border rounded-lg p-4 bg-gray-50 flex flex-col h-48 relative">
                  {/* Status badge in top right */}
                  <div className="absolute top-3 right-3">
                    <span className="px-2 py-1 bg-gray-200 text-xs rounded border border-gray-300">
                      -
                    </span>
                  </div>
                  
                  <div className="mb-2 pr-20">
                    <div className="text-sm font-semibold">No Orders</div>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1 mb-4 flex-grow">
                    <div>-</div>
                    <div>-</div>
                  </div>
                  <div className="mt-auto">
                    <button 
                      disabled
                      className="w-full py-2 border border-gray-300 rounded text-sm bg-gray-100 text-gray-400 cursor-not-allowed"
                    >
                      View Order Details
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="text-center">
            <Link href="/work-orders/past" className="inline-block px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
              View All Orders
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
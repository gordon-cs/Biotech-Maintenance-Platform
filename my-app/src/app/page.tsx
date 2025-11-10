"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import AuthStatus from "./components/AuthStatus"
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
  const [role, setRole] = useState<"lab" | "technician" | null>(null)
  const [roleLoaded, setRoleLoaded] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)

  // technician UI state
  const [search, setSearch] = useState("")
  const [labs, setLabs] = useState<Array<{ id: number; name: string; address?: string }>>([])
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([])
  const [selectedLab, setSelectedLab] = useState<number | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<"recent" | "oldest">("recent")
  const [orders, setOrders] = useState<WO[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // load role once and on auth changes
  useEffect(() => {
    let mounted = true
    const loadRole = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        if (mounted) setRoleLoaded(true)
        return
      }
      const userId = session.user.id
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle()
      if (!mounted) return
      if (!error && data) {
        const r = (data.role || "").toString().trim().toLowerCase()
        setRole(r === "technician" ? "technician" : r === "lab" ? "lab" : null)
      }
      if (mounted) setRoleLoaded(true)
    }
    loadRole()
    const { data: sub } = supabase.auth.onAuthStateChange(() => { loadRole() })
    return () => {
      mounted = false
      try { sub?.subscription?.unsubscribe?.() } catch {}
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const loadRole = async () => {
      try {
        console.log("Checking user role...")
        
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          console.log("No user session found")
          if (mounted) setRoleLoaded(true)
          return
        }
        
        const userId = session.user.id
        console.log("User ID:", userId)
        
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle()
          
        console.log("Profile query result:", data, error)
        
        if (!mounted) return
        
        if (!error && data) {
          const r = (data.role || "").toString().toLowerCase()
          const userRole = r === "technician" ? "technician" : r === "lab" ? "lab" : null
          
          console.log("Detected role:", userRole)
          setRole(userRole)
          
          // Auto-redirect lab users to manager dashboard
          if (userRole === "lab") {
            console.log("Lab user detected - redirecting to /manager")
            setIsRedirecting(true)
            // Use window.location.href for a more forceful redirect
            window.location.href = "/manager"
            return
          }
        }
        
        if (mounted) setRoleLoaded(true)
      } catch (err) {
        console.error("Error loading role:", err)
        if (mounted) setRoleLoaded(true)
      }
    }
    
    loadRole()
    return () => { mounted = false }
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
      type LabRow = { id: number; name: string; address?: string }
      type CategoryRow = { id: number; name: string }
      const labsRes = (await supabase.from("labs").select("id,name,address")) as PostgrestResponse<LabRow>
      const catsRes = (await supabase.from("categories").select("id,name")) as PostgrestResponse<CategoryRow>

      if (!mounted) return

      if (!labsRes.error && labsRes.data) {
        // convert nullable address -> undefined to match state type
        setLabs(labsRes.data.map(l => ({ id: l.id, name: l.name, address: l.address ?? undefined })))
      }

      if (!catsRes.error && catsRes.data) {
        setCategories(catsRes.data) // CategoryRow matches state shape
      }

      // then load work orders
      await loadWorkOrders()
    }
    load()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy])

  const loadWorkOrders = async () => {
    setLoading(true)
    setMessage(null)
    const { data, error } = await supabase
      .from("work_orders")
      .select("id,title,description,date,category_id,lab,created_by,status,created_at,address_id")
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
      created_at?: string | null
      address_id?: number | string | null
    }

    const labsMap = new Map<number,string>()
    const catsMap = new Map<number,string>()
    labs.forEach(l => labsMap.set(l.id, l.name))
    categories.forEach(c => catsMap.set(c.id, c.name))

    const raw = (data || []) as WorkOrdersRow[]
    const enriched = raw.map((wo) => ({
      id: Number(wo.id),
      title: wo.title ?? null,
      description: wo.description ?? null,
      date: wo.date ?? null,
      category_id: wo.category_id != null ? Number(wo.category_id) : null,
      lab: wo.lab != null ? Number(wo.lab) : null,
      created_by: wo.created_by ?? null,
      status: wo.status ?? null,
      created_at: wo.created_at ?? null,
      address: null,
      labName: wo.lab ? labsMap.get(Number(wo.lab)) ?? null : null,
      categoryName: wo.category_id ? catsMap.get(Number(wo.category_id)) ?? null : null
    })) as WO[]

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

    // update local state
    setOrders((prev) =>
      prev.map((o) => (o.id === woId ? { ...o, status: "claimed", assigned_to: userId } : o))
    )
    // if the selected item was the one accepted, update selection
    if (selectedId === woId) {
      // keep selectedId, but selectedOrder derived from orders will reflect change
      // trigger a small state update if needed:
      setSelectedId(woId)
    }

    setLoading(false)
  }

  // derived lists
  const filteredOrders = orders.filter((o) => {
    if (search) {
      const hay = ((o.title || "") + " " + (o.description || "") + " " + (o.labName || "")).toLowerCase()
      if (!hay.includes(search.toLowerCase())) return false
    }
    if (selectedLab && o.lab !== selectedLab) return false
    if (selectedCategory && o.category_id !== selectedCategory) return false
    return true
  })
  const selectedOrder = orders.find((o) => o.id === selectedId) ?? (filteredOrders[0] ?? null)

  // wait for role load
  if (!roleLoaded) return null

  // Technician view (top header kept identical)
  if (role === "technician") {
    return (
      <div className="font-sans min-h-screen p-8 bg-white text-black">
        <main className="max-w-6xl mx-auto">
          <header className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold">Biotech Maintenance Platform</h1>
            <AuthStatus />
          </header>

          {/* Filter bar */}
          <section className="space-y-6">
            <div className="rounded-xl bg-gray-50 p-4 flex gap-3 items-center">
              <input
                type="search"
                placeholder="Search Request"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-4 py-3 border rounded-lg bg-white"
              />

              <select
                value={selectedLab ?? ""}
                onChange={(e) => setSelectedLab(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-3 border rounded-lg bg-white"
              >
                <option value="">Location</option>
                {labs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedCategory ?? ""}
                onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-3 border rounded-lg bg-white"
              >
                <option value="">Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value === "oldest" ? "oldest" : "recent")}
                className="px-3 py-3 border rounded-lg bg-white"
              >
                <option value="recent">Most Recent</option>
                <option value="oldest">Oldest</option>
              </select>

              <button onClick={() => loadWorkOrders()} className="ml-2 px-3 py-3 border rounded-lg bg-white">
                Filters
              </button>
            </div>

            {/* Content two-column: list | detail */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 bg-white border rounded-xl p-4 h-[70vh] overflow-auto">
                <h3 className="text-sm text-gray-600 mb-3">Results</h3>

                <div className="space-y-4">
                  {loading && <p className="text-sm text-gray-500">Loading...</p>}
                  {!loading && filteredOrders.length === 0 && <p className="text-sm text-gray-500">No requests found</p>}

                  {filteredOrders.map((wo) => (
                    <button
                      key={wo.id}
                      onClick={() => setSelectedId(wo.id)}
                      className={`w-full text-left p-3 border rounded-lg flex gap-3 items-start ${selectedId === wo.id ? "ring-2 ring-green-400 bg-green-50" : "bg-white"}`}
                    >
                      <div className="w-12 h-12 rounded-md bg-gray-100 flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-600" viewBox="0 0 24 24" fill="none">
                          <path d="M14 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M10 21v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M3 11h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>

                      <div className="flex-1">
                        <div className="flex justify-between">
                          <div>
                            <div className="text-sm font-medium">{wo.title ?? "Title"}</div>
                            <div className="text-xs text-gray-500">{wo.labName ?? "Lab"}</div>
                            <div className="text-xs text-gray-500">{wo.address ?? ""}</div>
                          </div>
                          <div className="text-xs text-gray-500">{wo.categoryName ?? "Category"}</div>
                        </div>

                        <div className="mt-2 text-sm text-gray-600">{(wo.description || "").slice(0, 120)}{(wo.description || "").length > 120 ? "..." : ""}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2 bg-white border rounded-xl p-6 h-[70vh] overflow-auto flex flex-col">
                {selectedOrder ? (
                  <>
                    <div className="flex gap-4 items-start mb-4">
                      <div className="w-16 h-16 rounded-md bg-gray-100 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-600" viewBox="0 0 24 24" fill="none">
                          <path d="M14 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>

                      <div className="flex-1">
                        <div className="text-sm text-gray-600">{selectedOrder.labName}</div>
                        <h2 className="text-xl font-semibold">{selectedOrder.title}</h2>
                        <div className="text-xs text-gray-500 mt-1">Submitted by {selectedOrder.creatorEmail ?? selectedOrder.created_by ?? "Unknown"} • {selectedOrder.created_at}</div>
                        <div className="text-sm text-gray-700 mt-2">{selectedOrder.address ?? ""}</div>
                        <div className="text-sm text-gray-600 mt-1">{selectedOrder.categoryName ?? ""}</div>
                      </div>

                      <div className="text-sm">
                        <span className="px-3 py-1 rounded-full bg-gray-200 text-xs">{selectedOrder.status ?? "Status"}</span>
                      </div>
                    </div>

                    <hr className="my-3" />

                    <div className="flex-1 overflow-auto">
                      <p className="text-sm text-gray-700">{selectedOrder.description}</p>

                      <div className="mt-6 grid grid-cols-3 gap-4">
                        <div className="h-28 bg-gray-100 rounded flex items-center justify-center">Image</div>
                        <div className="h-28 bg-gray-100 rounded flex items-center justify-center">Image</div>
                        <div className="h-28 bg-gray-100 rounded flex items-center justify-center">Image</div>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={() => acceptJob(selectedOrder?.id ?? null)}
                        disabled={loading || !selectedOrder}
                        className="px-4 py-2 border rounded-full disabled:opacity-50"
                      >
                        Accept Job
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-500">Select a request to see details</div>
                )}
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
  // Default view (no specific role or non-lab/technician users)
  return (
    <div className="font-sans min-h-screen p-8 bg-white text-black">
      <main className="max-w-3xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Biotech Maintenance Platform</h1>
          <AuthStatus />
        </header>

        <section>
          {/* keep lab submission UI unchanged */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              <label className="block">
                <div className="flex items-center gap-3 border rounded-xl px-4 py-6">
                  <svg className="w-6 h-6 text-gray-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L15 8H9L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 14H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M6 18H18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>

                  <input
                    value={serviceArea}
                    onChange={(e) => setServiceArea(e.target.value)}
                    placeholder="Service Area"
                    className="flex-1 bg-transparent outline-none text-lg placeholder-gray-500"
                    required
                  />
                </div>
              </label>

              {/* Row: Date and Category */}
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <div className="flex items-center gap-3 border rounded-xl px-4 py-4">
                    <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 11H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="bg-transparent outline-none text-sm"
                      required
                    />
                  </div>
                </label>

                <label className="block">
                  <div className="flex items-center gap-3 border rounded-xl px-4 py-4">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="bg-transparent outline-none text-sm w-full"
                      required
                    >
                      <option value="" disabled>Category</option>
                      {categoriesList.map((cat) => (
                        <option key={cat.id} value={cat.slug}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </label>
              </div>

              {/* Navigate to the full submission page */}
              <div>
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/work-orders/submission?category=${encodeURIComponent(
                        category
                      )}&date=${encodeURIComponent(date)}`
                    )
                  }
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-full font-semibold"
                >
                  Submit Work Order
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  )
}

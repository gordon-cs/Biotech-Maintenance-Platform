"use client"

import React, { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"

// payload type (no `any`)
type WorkOrderPayload = {
  title: string | null
  description: string | null
  equipment: string | null
  urgency: "low" | "normal" | "high" | "critical" | string | null
  lab?: number | null
  category_id?: number | null
  date?: string | null
  created_by?: string | null
  address_id?: number | null
  initial_fee?: number | null
}

// small row shapes used for casting query results
type LabRow = { id: number; manager_id: string }
// full category shape used in the dropdown
type CategoryRow = { id: number; slug: string; name: string }
type AddressRow = { id: number; line1: string | null; line2: string | null; city: string | null; state: string | null; zipcode: string | null }
type InsertIdRow = { id: string } // bigint/int8 is returned as string by the client

export default function WorkOrderSubmission() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialCategory = searchParams?.get("category") ?? ""
  const initialDate = searchParams?.get("date") ?? ""
  const initialTitle = searchParams?.get("title") ?? ""
  const initialAddressId = searchParams?.get("address_id") ?? ""

  const initialDescription = searchParams?.get("description") ?? ""
  const initialEquipment = searchParams?.get("equipment") ?? ""
  const initialUrgency = searchParams?.get("urgency") ?? ""

  const [form, setForm] = useState({
    title: initialTitle,
    description: initialDescription,
    equipment: initialEquipment,
    urgency: initialUrgency, // display "Select..." by default
    category_id: initialCategory, // can be slug or id
    date: initialDate,
    address_id: initialAddressId, // new field for address selection
  })
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [addresses, setAddresses] = useState<AddressRow[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ id?: string; message: string } | null>(null)
  // Fixed initial fee set by platform admin (BBM)
  const labInitialFee = 50.00 // Platform-wide initial service fee

  useEffect(() => {
    let mounted = true
    const load = async () => {
      // Load categories
      const { data: catData, error: catError } = await supabase.from("categories").select("id,slug,name")
      if (!catError && catData && mounted) {
        setCategories(catData as CategoryRow[])
      }

      // Load addresses for the current user's lab
      try {
        const { data: authData } = await supabase.auth.getUser()
        if (authData?.user?.id) {
          // Get the user's lab
          const { data: labData } = await supabase
            .from("labs")
            .select("id")
            .eq("manager_id", authData.user.id)
            .maybeSingle()
          
          if (labData?.id) {
            // Load addresses for this lab
            const { data: addrData, error: addrError } = await supabase
              .from("addresses")
              .select("id, line1, line2, city, state, zipcode")
              .eq("lab_id", labData.id)
            
            if (!addrError && addrData && mounted) {
              setAddresses(addrData as AddressRow[])
            }
          }
        }
      } catch (err) {
        console.error("Error loading addresses:", err)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    
    // Handle "add_new" address option
    if (name === "address_id" && value === "add_new") {
      const returnParams = new URLSearchParams()
      returnParams.set("title", form.title)
      returnParams.set("description", form.description)
      returnParams.set("equipment", form.equipment)
      returnParams.set("urgency", form.urgency)
      returnParams.set("category", form.category_id != null ? String(form.category_id) : "")
      returnParams.set("date", form.date)
      router.push(`/manage-addresses?returnTo=/work-orders/submission&${returnParams.toString()}`)
      return
    }
    
    setForm((s) => ({ ...s, [name]: value }))
  }

  // Helper function to format address for display
  const formatAddress = (addr: AddressRow) => {
    const parts = [addr.line1, addr.city, addr.state, addr.zipcode].filter(Boolean)
    return parts.join(", ")
  }

  // Ensure current user is a manager of a lab and return the lab id
  const resolveLabIdForManager = async (userId: string): Promise<number> => {
    // removed generic on .from to avoid mismatched generic typing; cast result instead
    const res = await supabase
      .from("labs")
      .select("id, manager_id")
      .eq("manager_id", userId)
      .maybeSingle()

    if (res.error) throw res.error
    const labRow = res.data as LabRow | null
    if (!labRow?.id) {
      throw new Error("You are not registered as a manager of any lab.")
    }
    return Number(labRow.id)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setResult(null)
    setLoading(true)

    // client-side validation: require all fields except equipment
    if (!form.title || !form.title.trim()) {
      setResult({ message: "Title is required." })
      setLoading(false)
      return
    }
    if (!form.description || !form.description.trim()) {
      setResult({ message: "Description is required." })
      setLoading(false)
      return
    }
    if (!form.urgency || !String(form.urgency).trim()) {
      setResult({ message: "Please select an urgency." })
      setLoading(false)
      return
    }
    if (!form.category_id || !String(form.category_id).trim()) {
      setResult({ message: "Please select a category." })
      setLoading(false)
      return
    }
    if (!form.date || !String(form.date).trim()) {
      setResult({ message: "Please select a date." })
      setLoading(false)
      return
    }
    if (!form.address_id || !String(form.address_id).trim()) {
      setResult({ message: "Please select a service area (address)." })
      setLoading(false)
      return
    }
    // Ensure address_id is a finite number (protect against tampered or non-numeric input)
    const addressIdNum = Number(form.address_id)
    if (!Number.isFinite(addressIdNum)) {
      setResult({ message: "Please select a valid service area (address)." })
      setLoading(false)
      return
    }

    try {
      const { data: authData, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      const user = authData?.user
      if (!user?.id) throw new Error("Not authenticated.")

      // Only allow labs where the current user is the manager
      const labId = await resolveLabIdForManager(user.id)

      // resolve category id if the provided value is a slug
      let resolvedCategoryId: number | null = null
      const catVal = (form.category_id ?? "").toString().trim()
      if (catVal) {
        if (/^\d+$/.test(catVal)) {
          resolvedCategoryId = Number(catVal)
        } else {
          const catRes = await supabase
            .from("categories")
            .select("id")
            .eq("slug", catVal)
            .maybeSingle()
          if (catRes.error) {
            setResult({ message: "Unable to resolve category." })
            setLoading(false)
            return
          }
          const catRow = catRes.data as { id: number } | null
          resolvedCategoryId = catRow?.id ?? null
        }
      }

      // Category is required in the form, but resolvedCategoryId
      // can still be null (e.g. an unrecognized slug). Don't proceed with the insert
      // if we couldn't resolve a valid numeric category id — surface a user-friendly error.
      if (catVal && resolvedCategoryId === null) {
        setResult({ message: "Please select a valid category." })
        setLoading(false)
        return
      }
      
      const payload: WorkOrderPayload = {
        title: form.title || null,
        description: form.description || null,
        equipment: form.equipment || null,
        // if user didn't pick an urgency (empty string), default to "normal"
        urgency: (form.urgency && form.urgency.trim() ? String(form.urgency) : "normal").toLowerCase(),
        lab: labId,
        category_id: resolvedCategoryId,
        date: form.date || null,
        created_by: user.id,
        address_id: addressIdNum,
        initial_fee: labInitialFee,
      }

      const { data, error } = await supabase
        .from("work_orders")
        .insert(payload)
        .select("id")
        .single()

      if (error) {
        setResult({ message: `Insert error: ${error.message}` })
      } else {
        const inserted = data as InsertIdRow | null
        const workOrderId = inserted?.id

        if (workOrderId) {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            const response = await fetch('/api/invoices/create-initial-fee', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token || ''}`
              },
              body: JSON.stringify({ workOrderId })
            })

            if (response.ok) {
              setResult({ id: workOrderId, message: "Work order submitted successfully. Initial fee invoice sent to lab manager." })
            } else {
              const err = await response.json()
              setResult({ id: workOrderId, message: `Work order submitted, but failed to create initial fee invoice: ${err.error}` })
            }
          } catch (invoiceError) {
            setResult({ id: workOrderId, message: "Work order submitted, but failed to send initial fee invoice." })
          }
        }
        setForm({ title: "", description: "", equipment: "", urgency: "", category_id: "", date: "", address_id: "" })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setResult({ message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 border rounded bg-white w-full max-w-md mx-auto mt-8">
      {result && (
        <div className="mb-4 p-3 border rounded bg-gray-50 text-center">
          <div className="font-semibold">{result.message}</div>
          {result.id && <div className="text-xs text-gray-600 mt-1">ID: <code>{String(result.id)}</code></div>}
          <div className="mt-2">
            <button onClick={() => setResult(null)} className="px-3 py-1 bg-blue-600 text-white rounded">Close</button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <h3 className="font-semibold mb-4 text-center">Submit Work Order</h3>

        <label className="block mb-3">
          <div className="text-sm mb-1">Title *</div>
          <input name="title" value={form.title} onChange={handleChange} required className="w-full border px-2 py-1 rounded" />
        </label>

        <label className="block mb-3">
          <div className="text-sm mb-1">Description *</div>
          <textarea name="description" value={form.description} onChange={handleChange} required className="w-full border px-2 py-2 rounded" />
        </label>

        <label className="block mb-3">
          <div className="text-sm mb-1">Equipment</div>
          <input name="equipment" value={form.equipment} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
        </label>

        <label className="block mb-3">
          <div className="text-sm mb-1">Urgency *</div>
          <select
            name="urgency"
            value={form.urgency}
            onChange={handleChange}
            required
            className="w-full border px-2 py-1 rounded"
          >
            <option value="">Select…</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>

        <label className="block mb-3">
          <div className="text-sm mb-1">Category *</div>
          <select
            name="category_id"
            value={form.category_id}
            onChange={handleChange}
            required
            className="w-full border px-2 py-1 rounded"
          >
            <option value="">{categories.length ? "Select category…" : "Loading categories…"}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block mb-3">
          <div className="text-sm mb-1">Service Area (Address) *</div>
          <select
            name="address_id"
            value={form.address_id}
            onChange={handleChange}
            className="w-full border px-2 py-1 rounded"
            required
          >
            <option value="">Select an address...</option>
            {addresses.map((addr) => (
              <option key={addr.id} value={addr.id}>
                {formatAddress(addr)}
              </option>
            ))}
            <option value="add_new" className="font-semibold">+ Add New Address</option>
          </select>
        </label>

        {labInitialFee > 0 && (
          <div className="mb-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-900">Initial Service Fee</p>
              </div>
              <p className="text-2xl font-bold text-blue-900">${labInitialFee.toFixed(2)}</p>
            </div>
          </div>
        )}

        <label className="block mb-4">
          <div className="text-sm mb-1">Date *</div>
          <input type="date" name="date" value={form.date} onChange={handleChange} required className="w-full border px-2 py-1 rounded" />
        </label>

        <div className="flex items-center gap-2">
          <button type="submit" disabled={loading} className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-60">
            {loading ? "Submitting..." : "Submit Work Order"}
          </button>
          {result && !result.id && <p className="text-sm text-red-600">{result.message}</p>}
        </div>
      </form>

      <div className="mt-4 text-center">
        <Link
          href="/"
          className="inline-flex items-center px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
        >
          Return Home
        </Link>
      </div>
    </div>
  )
}

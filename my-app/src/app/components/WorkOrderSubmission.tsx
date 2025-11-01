"use client"

import React, { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

// payload type (no `any`)
type WorkOrderPayload = {
  title: string | null
  description: string | null
  equipment: string | null
  urgency: "low" | "medium" | "high" | "critical" | string | null
  lab?: number | null
  category_id?: number | null
  date?: string | null
  created_by?: string | null
}

// small row shapes used for casting query results
type LabRow = { id: number; manager_id: string }
// full category shape used in the dropdown
type CategoryRow = { id: number; slug: string; name: string }
type InsertIdRow = { id: string } // bigint/int8 is returned as string by the client

export default function WorkOrderSubmission() {
  const searchParams = useSearchParams()
  const initialCategory = searchParams?.get("category") ?? ""
  const initialDate = searchParams?.get("date") ?? ""

  const [form, setForm] = useState({
    title: "",
    description: "",
    equipment: "",
    urgency: "", // display "Select..." by default
    category_id: initialCategory, // can be slug or id
    date: initialDate,
  })
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ id?: string; message: string } | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const { data, error } = await supabase.from("categories").select("id,slug,name")
      if (!error && data && mounted) {
        setCategories(data as CategoryRow[])
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
    setForm((s) => ({ ...s, [name]: value }))
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

    if (!form.title.trim()) {
      setResult({ message: "Title is required." })
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
        setResult({ id: inserted?.id, message: "Work order submitted successfully." })
        setForm({ title: "", description: "", equipment: "", urgency: "", category_id: "", date: "" })
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
          <div className="text-sm mb-1">Description</div>
          <textarea name="description" value={form.description} onChange={handleChange} className="w-full border px-2 py-2 rounded" />
        </label>

        <label className="block mb-3">
          <div className="text-sm mb-1">Equipment</div>
          <input name="equipment" value={form.equipment} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
        </label>

        <label className="block mb-3">
          <div className="text-sm mb-1">Urgency</div>
          <select
            name="urgency"
            value={form.urgency}
            onChange={handleChange}
            className="w-full border px-2 py-1 rounded"
          >
            <option value="">Select…</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>

        <label className="block mb-3">
          <div className="text-sm mb-1">Category</div>
          <select
            name="category_id"
            value={form.category_id}
            onChange={handleChange}
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

        <label className="block mb-4">
          <div className="text-sm mb-1">Date</div>
          <input type="date" name="date" value={form.date} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
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

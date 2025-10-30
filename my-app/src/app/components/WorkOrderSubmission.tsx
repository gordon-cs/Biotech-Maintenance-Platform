"use client"

import React, { useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"

// add a specific payload type instead of `any`
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

// change returned row id to string (UUID) or use string | number if uncertain
type WorkOrderRow = {
  id: string
  title?: string | null
  description?: string | null
  equipment?: string | null
  urgency?: string | null
  lab?: number | null
  category_id?: number | null
  date?: string | null
  created_by?: string | null
  status?: string | null
  created_at?: string | null
}

// update result state type to accept string id
export default function WorkOrderSubmission() {
  const [form, setForm] = useState({
    title: "",
    description: "",
    equipment: "",
    urgency: "",
    category_id: "",
    date: "",
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ id?: string; message: string } | null>(null)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setForm((s) => ({ ...s, [name]: value }))
  }

  // Ensure current user is a manager of a lab and return the lab id
  const resolveLabIdForManager = async (userId: string): Promise<number> => {
    const { data: labRow, error } = await supabase
      .from("labs")
      .select("id, manager_id")
      .eq("manager_id", userId)
      .maybeSingle()

    if (error) throw error
    if (!labRow?.id) {
      throw new Error("You are not registered as a manager of any lab.")
    }
    // (If the user manages multiple labs, provide a selection UI or use the first one.)
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
      const { data: { user }, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      if (!user?.id) throw new Error("Not authenticated.")

      // 🔹 Only allow labs where the current user is the manager
      const labId = await resolveLabIdForManager(user.id)

      const payload: WorkOrderPayload = {
        title: form.title || null,
        description: form.description || null,
        equipment: form.equipment || null,
        urgency: form.urgency || "normal",
        lab: labId,
        category_id: form.category_id ? Number(form.category_id) : null,
        date: form.date || null,
        created_by: user.id,
      }


      // typed insert expecting id as string (bigint returned as string)
      const { data, error } = await supabase
        .from("work_orders")
        .insert(payload)
        .select("id")
        .single()

      if (error) {
        setResult({ message: `Insert error: ${error.message}` })
      } else {
        const inserted = data as { id: string } | null
        setResult({ id: inserted?.id, message: "Work order submitted successfully." })
        setForm({ title: "", description: "", equipment: "", urgency: "", category_id: "", date: "" })
      }
    } catch (err: unknown) {
      // avoid `any` — extract message safely
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
          {result.id && (
            <div className="text-xs text-gray-600 mt-1">
              ID: <code>{String(result.id)}</code>
            </div>
          )}
          <div className="mt-2">
            <button onClick={() => setResult(null)} className="px-3 py-1 bg-blue-600 text-white rounded">
              Close
            </button>
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
            required
            className="w-full border px-2 py-1 rounded"
          >
            <option value="">Select…</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>

        {/* No Lab input field (lab is resolved automatically) */}

        <label className="block mb-3">
          <div className="text-sm mb-1">Category (id)</div>
          <input name="category_id" value={form.category_id} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
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

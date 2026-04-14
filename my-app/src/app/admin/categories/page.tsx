"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

type Cat = {
  id: number
  slug?: string | null
  name?: string | null
  initial_fee?: number | null
  active?: boolean | null
  created_at?: string | null
}

export default function AdminCategoriesPage() {
  const [cats, setCats] = useState<Cat[]>([])
  const [loading, setLoading] = useState(false)
  const [feeDrafts, setFeeDrafts] = useState<Record<number, string>>({})
  const [savingFee, setSavingFee] = useState<Record<number, boolean>>({})
  const [newName, setNewName] = useState("")
  const [newSlug, setNewSlug] = useState("")
  const [newInitialFee, setNewInitialFee] = useState("0")
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<Record<number, boolean>>({})
  const [toggling, setToggling] = useState<Record<number, boolean>>({})
  const [message, setMessage] = useState<string | null>(null)

  // move loader to component scope so both useEffect and buttons can call it
  const loadAll = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name, initial_fee, active, created_at")
        .order("id", { ascending: true })
      if (error) {
        console.error(error)
        setMessage("Failed to load categories.")
        setCats([])
        setFeeDrafts({})
      } else {
        setCats(data ?? [])
        const drafts: Record<number, string> = {}
        for (const cat of data ?? []) drafts[cat.id] = String(cat.initial_fee ?? 0)
        setFeeDrafts(drafts)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "")
      .slice(0, 60)

  const addCategory = async () => {
    const name = newName.trim()
    const slug = (newSlug.trim() || slugify(name)).trim()
    const initialFee = Number(newInitialFee || "0")
    if (!name) {
      setMessage("Enter a category name.")
      return
    }
    if (!Number.isFinite(initialFee) || initialFee < 0) {
      setMessage("Initial fee must be a non-negative number.")
      return
    }
    setAdding(true)
    setMessage(null)
    try {
      const { data, error } = await supabase
        .from("categories")
        .insert({ name, slug, initial_fee: initialFee, active: true })
        .select()
        .maybeSingle()
      if (error) {
        console.error(error)
        setMessage("Failed to add category: " + error.message)
      } else if (data) {
        setCats((s) => [...s, { id: data.id, name: data.name, slug: data.slug, initial_fee: data.initial_fee, active: data.active, created_at: data.created_at }])
        setNewName("")
        setNewSlug("")
        setNewInitialFee("0")
      }
    } catch (err) {
      console.error(err)
      setMessage("Unexpected error adding category.")
    } finally {
      setAdding(false)
    }
  }

  const removeCategory = async (id: number) => {
    const ok = window.confirm("Delete this category? This cannot be undone.")
    if (!ok) return
    setDeleting((s) => ({ ...s, [id]: true }))
    setMessage(null)
    try {
      const { error } = await supabase.from("categories").delete().eq("id", id)
      if (error) {
        console.error(error)
        setMessage("Failed to delete category: " + error.message)
      } else {
        setCats((s) => s.filter((c) => c.id !== id))
      }
    } catch (err) {
      console.error(err)
      setMessage("Unexpected error deleting category.")
    } finally {
      setDeleting((s) => ({ ...s, [id]: false }))
    }
  }

  const saveInitialFee = async (id: number) => {
    const parsed = Number.parseFloat((feeDrafts[id] ?? "").trim())
    if (!Number.isFinite(parsed) || parsed < 0) {
      setMessage("Initial fee must be a non-negative number.")
      return
    }

    setSavingFee((s) => ({ ...s, [id]: true }))
    setMessage(null)
    try {
      const { data, error } = await supabase
        .from("categories")
        .update({ initial_fee: parsed })
        .eq("id", id)
        .select("id, initial_fee")
        .maybeSingle()

      if (error) {
        console.error(error)
        setMessage("Failed to update initial fee: " + error.message)
      } else if (data) {
        setCats((s) => s.map((c) => (c.id === id ? { ...c, initial_fee: data.initial_fee } : c)))
        setFeeDrafts((s) => ({ ...s, [id]: String(data.initial_fee ?? 0) }))
      }
    } catch (err) {
      console.error(err)
      setMessage("Unexpected error updating initial fee.")
    } finally {
      setSavingFee((s) => ({ ...s, [id]: false }))
    }
  }

  const toggleActive = async (id: number, current: boolean | null | undefined) => {
    setToggling((s) => ({ ...s, [id]: true }))
    setMessage(null)
    try {
      const { data, error } = await supabase
        .from("categories")
        .update({ active: !current })
        .eq("id", id)
        .select()
        .maybeSingle()
      if (error) {
        console.error(error)
        setMessage("Failed to update category: " + error.message)
      } else if (data) {
        setCats((s) => s.map((c) => (c.id === id ? { ...c, active: data.active } : c)))
      }
    } catch (err) {
      console.error(err)
      setMessage("Unexpected error updating category.")
    } finally {
      setToggling((s) => ({ ...s, [id]: false }))
    }
  }

  return (
    <div className="p-8">
      <main className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Manage Categories</h2>
          <div className="flex items-center gap-3">
            <button onClick={() => { setMessage(null); void loadAll(); }} className="px-3 py-1 border rounded">
              Refresh
            </button>
            {loading ? <div className="text-sm text-gray-500">Loading...</div> : null}
          </div>
        </div>

        {message && <div className="mb-3 text-sm text-red-600">{message}</div>}

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New category name"
              className="px-2 py-2 border rounded w-64"
            />
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="optional slug"
              className="px-2 py-2 border rounded w-48"
            />
            <input
              value={newInitialFee}
              onChange={(e) => setNewInitialFee(e.target.value)}
              placeholder="initial fee"
              type="number"
              min="0"
              step="0.01"
              className="w-28 px-2 py-2 border rounded"
            />
            <button
              onClick={addCategory}
              disabled={adding}
              className="px-3 py-2 bg-green-600 text-white rounded disabled:opacity-50"
            >
              {adding ? "Adding..." : "Add Category"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-6">Loading...</div>
          ) : (
            <ul className="space-y-2 p-4">
              {cats.length === 0 && <li className="text-sm text-gray-600">No categories found.</li>}
              {cats.map((c) => (
                <li key={c.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex flex-col">
                    <span className="font-medium">{c.name ?? `#${c.id}`}</span>
                    <span className="text-xs text-gray-600">{c.slug ?? "—"}</span>
                    <span className="text-xs text-gray-600">Initial fee: ${Number(c.initial_fee ?? 0).toFixed(2)}</span>
                    <span className="text-xs text-gray-500">Created: {c.created_at ? new Date(c.created_at).toLocaleString() : "—"}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      value={feeDrafts[c.id] ?? ""}
                      onChange={(e) => setFeeDrafts((s) => ({ ...s, [c.id]: e.target.value }))}
                      className="w-24 px-2 py-1 border rounded text-sm"
                      type="number"
                      min="0"
                      step="0.01"
                    />
                    <button
                      onClick={() => saveInitialFee(c.id)}
                      disabled={!!savingFee[c.id]}
                      className="px-2 py-1 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
                    >
                      {savingFee[c.id] ? "Saving..." : "Save Fee"}
                    </button>
                    <button
                      onClick={() => toggleActive(c.id, c.active)}
                      disabled={!!toggling[c.id]}
                      className={`px-2 py-1 text-sm rounded ${c.active ? "bg-yellow-500 text-white" : "bg-gray-200 text-gray-800"}`}
                    >
                      {toggling[c.id] ? "Saving..." : c.active ? "Active" : "Inactive"}
                    </button>

                    <button
                      onClick={() => removeCategory(c.id)}
                      disabled={!!deleting[c.id]}
                      className="px-2 py-1 text-sm bg-red-600 text-white rounded disabled:opacity-50"
                    >
                      {deleting[c.id] ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
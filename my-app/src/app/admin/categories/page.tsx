"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

type Cat = {
  id: number
  slug?: string | null
  name?: string | null
  active?: boolean | null
  initial_fee?: number | null
  created_at?: string | null
}

export default function AdminCategoriesPage() {
  const [cats, setCats] = useState<Cat[]>([])
  const [loading, setLoading] = useState(false)
  const [newName, setNewName] = useState("")
  const [newSlug, setNewSlug] = useState("")
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<Record<number, boolean>>({})
  const [toggling, setToggling] = useState<Record<number, boolean>>({})
  const [savingFee, setSavingFee] = useState<Record<number, boolean>>({})
  const [feeDrafts, setFeeDrafts] = useState<Record<number, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [newInitialFee, setNewInitialFee] = useState("50")

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name, active, initial_fee, created_at")
        .order("id", { ascending: true })
      if (error) {
        console.error(error)
        setMessage("Failed to load categories.")
      } else {
        setCats(data ?? [])
        const nextDrafts: Record<number, string> = {}
        for (const cat of data ?? []) {
          nextDrafts[cat.id] = String(cat.initial_fee ?? 0)
        }
        setFeeDrafts(nextDrafts)
      }
      setLoading(false)
    }
    load()
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
    const parsedNewFee = Number.parseFloat(newInitialFee)
    if (!name) {
      setMessage("Enter a category name.")
      return
    }
    if (!Number.isFinite(parsedNewFee) || parsedNewFee < 0) {
      setMessage("Enter a valid non-negative initial fee.")
      return
    }
    setAdding(true)
    setMessage(null)
    try {
      const { data, error } = await supabase
        .from("categories")
        .insert({ name, slug, active: true, initial_fee: parsedNewFee })
        .select()
        .maybeSingle()
      if (error) {
        console.error(error)
        setMessage("Failed to add category: " + error.message)
      } else if (data) {
        setCats((s) => [
          ...s,
          {
            id: data.id,
            name: data.name,
            slug: data.slug,
            active: data.active,
            initial_fee: data.initial_fee,
            created_at: data.created_at,
          },
        ])
        setFeeDrafts((s) => ({ ...s, [data.id]: String(data.initial_fee ?? 0) }))
        setNewName("")
        setNewSlug("")
        setNewInitialFee("50")
      }
    } catch (err) {
      console.error(err)
      setMessage("Unexpected error adding category.")
    } finally {
      setAdding(false)
    }
  }

  const saveInitialFee = async (id: number) => {
    const parsed = Number.parseFloat((feeDrafts[id] ?? "").trim())
    if (!Number.isFinite(parsed) || parsed < 0) {
      setMessage("Enter a valid non-negative initial fee.")
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
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Manage Categories</h2>
        <div className="flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name"
            className="px-2 py-1 border rounded"
          />
          <input
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            placeholder="optional slug"
            className="px-2 py-1 border rounded"
          />
          <input
            value={newInitialFee}
            onChange={(e) => setNewInitialFee(e.target.value)}
            placeholder="Initial fee"
            inputMode="decimal"
            className="w-28 px-2 py-1 border rounded"
            aria-label="New category initial fee"
          />
          <button
            onClick={addCategory}
            disabled={adding}
            className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50"
          >
            {adding ? "Adding..." : "Add"}
          </button>
        </div>
      </div>

      {message && <div className="mb-3 text-sm text-red-600">{message}</div>}

      {loading ? (
        <div>Loading...</div>
      ) : (
        <ul className="space-y-2">
          {cats.length === 0 && <li className="text-sm text-gray-600">No categories found.</li>}
          {cats.map((c) => (
            <li key={c.id} className="flex items-center justify-between p-2 border rounded">
              <div className="flex flex-col">
                <span className="font-medium">{c.name ?? `#${c.id}`}</span>
                <span className="text-xs text-gray-600">{c.slug ?? "—"}</span>
                <span className="text-xs text-gray-600">Initial fee: ${(Number(c.initial_fee ?? 0)).toFixed(2)}</span>
                <span className="text-xs text-gray-500">Created: {c.created_at ? new Date(c.created_at).toLocaleString() : "—"}</span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={feeDrafts[c.id] ?? ""}
                  onChange={(e) => setFeeDrafts((s) => ({ ...s, [c.id]: e.target.value }))}
                  className="w-24 px-2 py-1 border rounded text-sm"
                  inputMode="decimal"
                  aria-label={`Initial fee for category ${c.name ?? c.id}`}
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
  )
}
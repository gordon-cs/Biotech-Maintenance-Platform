"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

type Cat = {
  id: number
  slug?: string | null
  name?: string | null
  active?: boolean | null
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
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name, active, created_at")
        .order("id", { ascending: true })
      if (error) {
        console.error(error)
        setMessage("Failed to load categories.")
      } else {
        setCats(data ?? [])
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
    if (!name) {
      setMessage("Enter a category name.")
      return
    }
    setAdding(true)
    setMessage(null)
    try {
      const { data, error } = await supabase
        .from("categories")
        .insert({ name, slug, active: true })
        .select()
        .maybeSingle()
      if (error) {
        console.error(error)
        setMessage("Failed to add category: " + error.message)
      } else if (data) {
        setCats((s) => [...s, { id: data.id, name: data.name, slug: data.slug, active: data.active, created_at: data.created_at }])
        setNewName("")
        setNewSlug("")
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
                <span className="text-xs text-gray-500">Created: {c.created_at ? new Date(c.created_at).toLocaleString() : "—"}</span>
              </div>

              <div className="flex items-center gap-2">
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
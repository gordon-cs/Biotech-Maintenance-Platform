"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

type Profile = { id: string; email?: string | null; role?: string | null }

const AVAILABLE_ROLES = ["admin", "lab", "technician", "none"]

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase.from("profiles").select("id, email, role")
      if (error) console.error(error)
      setUsers(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const updateRole = async (userId: string, newRole: string | null) => {
    if (!userId) return
    const confirmed = window.confirm(`Change role for ${userId} to "${newRole ?? "none"}"?`)
    if (!confirmed) return

    setUpdating((s) => ({ ...s, [userId]: true }))
    try {
      const payload: { role?: string | null } = {}
      if (!newRole || newRole === "none") payload.role = null
      else payload.role = newRole

      const { error } = await supabase.from("profiles").update(payload).eq("id", userId)
      if (error) {
        alert("Update failed: " + error.message)
        return
      }

      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: payload.role ?? null } : u)))
    } catch (err) {
      console.error(err)
      alert("An unexpected error occurred")
    } finally {
      setUpdating((s) => ({ ...s, [userId]: false }))
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Manage Users</h2>
        {loading ? <div className="text-sm text-gray-500">Loading...</div> : null}
      </div>

      <table className="w-full text-sm table-auto border-collapse">
        <thead>
          <tr className="text-left">
            <th className="pb-2">ID</th>
            <th className="pb-2">Email</th>
            <th className="pb-2">Role</th>
            <th className="pb-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="py-2 align-top">{u.id}</td>
              <td className="py-2 align-top">{u.email ?? "-"}</td>
              <td className="py-2 align-top">
                <select
                  value={u.role ?? "none"}
                  onChange={(e) => {
                    const selected = e.target.value
                    // optimistic update locally so UI reflects selection before save
                    setUsers((prev) => prev.map((p) => (p.id === u.id ? { ...p, role: selected === "none" ? null : selected } : p)))
                  }}
                  className="px-2 py-1 border rounded"
                >
                  {AVAILABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-2 align-top">
                <button
                  onClick={() => updateRole(u.id, u.role ?? null)}
                  className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
                  disabled={!!updating[u.id]}
                >
                  {updating[u.id] ? "Saving..." : "Save"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
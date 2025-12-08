"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

type Profile = { id: string; email?: string | null; role?: string | null }

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("profiles").select("id, email, role")
      if (error) console.error(error)
      setUsers(data ?? [])
    }
    load()
  }, [])

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Manage Users</h2>
      <table className="w-full text-sm table-auto">
        <thead><tr><th>ID</th><th>Email</th><th>Role</th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className="border-t">
              <td className="py-2">{u.id}</td>
              <td className="py-2">{u.email ?? "-"}</td>
              <td className="py-2">{u.role ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

type WO = { id: number; title?: string | null; status?: string | null; assigned_to?: string | null }

export default function AdminWorkOrdersPage() {
  const [rows, setRows] = useState<WO[]>([])
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("work_orders").select("id, title, status, assigned_to")
      if (error) console.error(error)
      setRows(data ?? [])
    }
    load()
  }, [])

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Manage Work Orders</h2>
      <ul className="space-y-2">
        {rows.map(r => (
          <li key={r.id} className="p-3 border rounded">
            <div className="font-medium">{r.title ?? `#${r.id}`}</div>
            <div className="text-sm text-gray-600">Status: {r.status ?? "-"} — Assigned: {r.assigned_to ?? "none"}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
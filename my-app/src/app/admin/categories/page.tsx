"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

type Cat = { id: number; name?: string | null }

export default function AdminCategoriesPage() {
  const [cats, setCats] = useState<Cat[]>([])
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("categories").select("id, name")
      if (error) console.error(error)
      setCats(data ?? [])
    }
    load()
  }, [])

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Manage Categories</h2>
      <ul className="space-y-2">
        {cats.map(c => <li key={c.id} className="p-2 border rounded">{c.name ?? `#${c.id}`}</li>)}
      </ul>
    </div>
  )
}
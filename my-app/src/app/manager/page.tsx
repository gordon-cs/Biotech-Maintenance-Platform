"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"

type Category = { id: number; slug: string; name: string }

export default function ManagerDashboard() {
  const router = useRouter()
  const [serviceArea, setServiceArea] = useState("")
  const [date, setDate] = useState<string>("")
  const [category, setCategory] = useState("")
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data, error } = await supabase.from("categories").select("id,slug,name")
      if (!error && data && mounted) setCategories(data as Category[])
    })()
    return () => {
      mounted = false
    }
  }, [])

  // navigate to the dedicated submission page with pre-filled query params
  const handleNavigateToSubmission = (e?: React.FormEvent) => {
    e?.preventDefault()
    const params = new URLSearchParams()
    if (category) params.set("category", category)
    if (date) params.set("date", date)
    if (serviceArea) params.set("title", serviceArea)
    router.push(`/work-orders/submission?${params.toString()}`)
  }

  return (
    <div className="min-h-screen p-8 bg-white text-black">
      <main className="max-w-3xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Lab Manager Dashboard</h1>
          <nav className="flex gap-3">
            <Link href="/work-orders/past" className="px-3 py-1 bg-gray-200 rounded">Past Orders</Link>
            <Link href="/" className="px-3 py-1 bg-gray-100 rounded">Home</Link>
          </nav>
        </header>

        <section className="bg-white rounded p-6 shadow">
          <h2 className="text-lg font-semibold mb-4">Quick Submit Work Order</h2>

          <form onSubmit={handleNavigateToSubmission} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Service Area</label>
              <input
                value={serviceArea}
                onChange={(e) => setServiceArea(e.target.value)}
                className="w-full border px-3 py-2 rounded"
                placeholder="Short title or service area"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <div className="text-sm mb-1">Date</div>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border px-3 py-2 rounded" />
              </label>

              <label className="block">
                <div className="text-sm mb-1">Category</div>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border px-3 py-2 rounded" required>
                  <option value="">Select…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button type="submit" disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded">
                {loading ? "Preparing..." : "Go to Submission"}
              </button>
              <Link href="/work-orders/past" className="px-4 py-2 bg-gray-200 rounded">View Past Orders</Link>
            </div>

            {message && <div className="text-sm text-red-600 mt-2">{message}</div>}
            {success && <div className="text-sm text-green-600 mt-2">{success}</div>}
          </form>
        </section>
      </main>
    </div>
  )
}
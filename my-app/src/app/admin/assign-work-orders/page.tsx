"use client"

import Link from "next/link"
import { useEffect } from "react"

export default function AssignWorkOrdersPage() {
  useEffect(() => { document.title = "Assign Work Orders | Biotech Maintenance" }, [])

  return (
    <div className="min-h-screen p-8 bg-gray-50 text-black">
      <main className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Assign Work Orders</h1>
          <Link href="/admin" className="px-4 py-2 border rounded bg-white hover:bg-gray-50">Back</Link>
        </div>

        <div className="border rounded-lg bg-white p-6">
          <p className="text-gray-600">Placeholder UI — implement bulk assignment, filters, and assignment workflow here.</p>
        </div>
      </main>
    </div>
  )
}
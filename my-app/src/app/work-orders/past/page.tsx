"use client"

import React from "react"
import Link from "next/link"

type WorkOrderRow = {
  id: string
  title: string | null
  description?: string | null
  status?: string | null
  lab_name?: string | null
  location?: string | null
  category?: string | null
  created_at?: string | null
}

// static sample data — display-only
const SAMPLE_ORDERS: WorkOrderRow[] = [
  {
    id: "1",
    title: "Annual Equipment Check – Biosafety Cabinet",
    description: "Inspect filters and sensors. Ensure certification sticker is current.",
    status: "Done",
    lab_name: "Lab Name A",
    location: "1234 Elm Street, Springfield, IL 62704",
    category: "Maintenance",
    created_at: "2025-10-08 14:32:17",
  },
  {
    id: "2",
    title: "Temperature Alarm Investigation",
    description: "Freezer reported temp spike early this morning, investigate logs.",
    status: "Follow-Up",
    lab_name: "Lab Name B",
    location: "5678 Oak Ave, Springfield, IL 62704",
    category: "Urgent",
    created_at: "2025-10-07 09:15:02",
  },
  {
    id: "3",
    title: "Replace HEPA filter",
    description: "Replace HEPA filter on biological safety cabinet model X100.",
    status: "Done",
    lab_name: "Lab Name C",
    location: "9012 Pine Rd, Springfield, IL 62704",
    category: "Replacement",
    created_at: "2025-09-20 11:05:44",
  },
]

export default function PastOrdersPage() {
  const selected = SAMPLE_ORDERS[0]

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Past Orders (Display Only)</h1>
          <div className="flex gap-2 items-center">
            <Link href="/" className="px-3 py-1 bg-gray-200 rounded">Home</Link>
            <Link href="/work-orders/submission" className="px-3 py-1 bg-gray-300 text-gray-700 rounded">Submit Order</Link>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-6">
          {/* Left: Filters + List (disabled) */}
          <aside className="col-span-4 bg-white p-4 rounded shadow">
            <div className="mb-4 space-y-2">
              <input
                aria-label="Search"
                value=""
                onChange={() => {}}
                placeholder="Search Request"
                className="w-full border px-3 py-2 rounded bg-gray-100"
                disabled
              />
              <select value="" className="w-full border px-3 py-2 rounded bg-gray-100" disabled>
                <option value="">All status</option>
                <option value="open">Open</option>
                <option value="follow-up">Follow-Up</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div className="text-sm text-gray-600 mb-2">Results</div>
            <div className="space-y-3 max-h-[60vh] overflow-auto pr-2">
              {SAMPLE_ORDERS.map((o) => (
                <div
                  key={o.id}
                  className={`w-full text-left border rounded p-3 flex justify-between items-start bg-white`}
                >
                  <div>
                    <div className="text-xs text-gray-500">Lab: {o.lab_name ?? "—"}</div>
                    <div className="font-semibold">{o.title ?? "Untitled"}</div>
                    <div className="text-xs text-gray-500">{o.location}</div>
                    <div className="text-xs text-gray-400 mt-1">{o.category}</div>
                  </div>
                  <div className="ml-4">
                    <span className="px-3 py-1 text-xs rounded-full bg-gray-100">{o.status ?? "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* Right: Detail (display-only) */}
          <section className="col-span-8 bg-white p-6 rounded shadow min-h-[60vh]">
            {!selected && <div className="text-gray-600">No sample selected.</div>}
            {selected && (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm text-gray-500">Lab</div>
                    <h2 className="text-xl font-semibold">{selected.lab_name}</h2>
                    <div className="text-sm text-gray-500">{selected.location}</div>
                    <div className="mt-2 text-xs text-gray-400">Submitted: {selected.created_at}</div>
                  </div>
                  <div>
                    <span className="px-3 py-1 rounded-full bg-gray-100 text-sm">{selected.status}</span>
                  </div>
                </div>

                <hr className="my-4" />

                <div className="prose max-w-none">
                  <h3 className="text-lg font-medium">{selected.title}</h3>
                  <p className="text-sm text-gray-700">{selected.description}</p>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-4">
                  <div className="h-28 bg-gray-100 rounded flex items-center justify-center text-gray-400">Image</div>
                  <div className="h-28 bg-gray-100 rounded flex items-center justify-center text-gray-400">Image</div>
                  <div className="h-28 bg-gray-100 rounded flex items-center justify-center text-gray-400">Image</div>
                </div>

                <div className="mt-6 flex justify-between items-center">
                  <div className="text-sm text-gray-500">Category: {selected.category ?? "—"}</div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 bg-gray-200 rounded" disabled>Download Report</button>
                    <button className="px-3 py-1 bg-gray-200 rounded" disabled>Mark Follow-Up</button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
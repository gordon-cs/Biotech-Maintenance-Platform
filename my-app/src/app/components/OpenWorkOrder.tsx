"use client"

import React from "react"
import Link from "next/link"

export default function OpenWorkOrder() {
  return (
    <div className="min-h-screen p-8 bg-white text-black">
      <main className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Biotech Maintenance Platform</h1>
        </header>

        <section>
          <h2 className="text-lg font-semibold mb-4">Browse Open Requests</h2>
          <div className="bg-gray-50 rounded-2xl p-6 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {[1,2,3,4].map(i => (
                <article key={i} className="border rounded-xl p-4">
                  <p className="font-medium">Title</p>
                  <p className="text-sm text-gray-600">Date • Category</p>
                  <p className="text-sm text-gray-500 mt-4">Detailed Description</p>
                  <div className="mt-4">
                    <Link href={`/work-orders/${i}`} className="px-3 py-2 bg-gray-200 rounded-full text-sm">View Order Details</Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
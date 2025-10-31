"use client"

import React, { Suspense } from "react"
import WorkOrderSubmission from "../../components/WorkOrderSubmission"

export default function Page() {
  return (
    <main className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <Suspense fallback={<div>Loading submission...</div>}>
          <WorkOrderSubmission />
        </Suspense>
      </div>
    </main>
  )
}
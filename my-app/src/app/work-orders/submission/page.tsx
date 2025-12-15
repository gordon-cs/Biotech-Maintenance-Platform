"use client"

import React, { Suspense, useEffect } from "react"
import WorkOrderSubmission from "../../components/WorkOrderSubmission"

export default function Page() {
  useEffect(() => {
    document.title = "Submit Work Order | Biotech Maintenance"
  }, [])

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
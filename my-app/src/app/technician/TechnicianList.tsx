"use client"

import React from "react"
import type { WorkOrder } from "./types"

type Props = {
  items: WorkOrder[]
  selectedId?: number | null
  onSelect: (id: number) => void
  loading?: boolean
}

export default function TechnicianList({ items, selectedId, onSelect, loading }: Props) {
  if (loading) return <div className="text-sm text-gray-500 text-center py-4">Loading...</div>
  if (!items || !items.length) return <div className="text-sm text-gray-500 text-center py-8">No requests found</div>

  return (
    <div className="space-y-3">
      {items.map((wo) => {
        const numericId = Number(wo.id)
        const isSelected = selectedId != null && selectedId === numericId

        return (
          <button
            key={wo.id}
            onClick={() => onSelect(numericId)}
            className={`w-full text-left p-3 border rounded-lg transition-colors relative ${isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-white"}`}
          >
            <div className="absolute top-2 right-2 flex items-center gap-2">
              {/* removed default 'border' so badge edge is lighter like manager list */}
              <span className={`px-2 py-1 text-xs rounded font-medium ${getStatusClass(wo.status)}`}>
                {wo.status ?? "Open"}
              </span>
            </div>

            <div className="flex items-start gap-3 pr-24">
              <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-500 mb-1">{wo.labName}</div>
                <div className="font-medium text-sm mb-1">{wo.title ?? `#${wo.id}`}</div>
                {wo.address && <div className="text-xs text-gray-500 mb-1">{wo.address}</div>}
                <div className="text-xs text-gray-400">{(wo.categoryName ?? wo.category) ?? "N/A"}</div>

                {wo.urgency && (() => {
                  const u = (wo.urgency ?? "").toLowerCase()
                  return (
                    <div className={`text-xs mt-1 px-2 py-1 rounded inline-block ${
                      u === "critical" ? "bg-red-300 text-red-900" :
                      u === "high" ? "bg-red-100 text-red-800" :
                      u === "low" ? "bg-green-100 text-green-800" :
                      /* normal / medium / unknown */
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {wo.urgency}
                    </div>
                  )
                })()}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// helper to reuse manager's status badge style mapping
function getStatusClass(status?: string | null) {
  switch (status?.toLowerCase()) {
    case "completed":
      return "bg-green-100 text-green-800"
    case "claimed":
    case "in_progress":
    case "in progress":
      return "bg-blue-100 text-blue-800"
    case "pending":
      return "bg-yellow-100 text-yellow-800"
    case "canceled":
      return "bg-red-100 text-red-800"
    case "open":
      return "bg-gray-100 text-gray-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}
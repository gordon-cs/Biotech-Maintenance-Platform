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
  // debug: verify what's passed in (remove after confirming)
  // eslint-disable-next-line no-console
  console.log("TechnicianList items:", items, "loading:", loading)

  if (loading) return <div className="text-sm text-gray-500 text-center py-4">Loading...</div>
  if (!items || !items.length) return <div className="text-sm text-gray-500 text-center py-8">No requests found</div>

  return (
    <div className="space-y-3">
      {items.map((wo) => (
        <button
          key={wo.id}
          onClick={() => onSelect(wo.id)}
          className={`w-full text-left p-3 border rounded-lg transition-colors relative ${selectedId === wo.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-white"}`}
        >
          <div className="absolute top-2 right-2">
            <span className={`px-2 py-1 text-xs rounded ${wo.status?.toLowerCase() === "claimed" ? "bg-blue-100 text-blue-800" : wo.status?.toLowerCase() === "completed" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
              {wo.status ?? "Open"}
            </span>
          </div>

          <div className="font-medium text-lg mb-1">{wo.title ?? `#${wo.id}`}</div>
          {wo.address && <div className="text-sm text-gray-500 mb-1">{wo.address}</div>}
          <div className="text-xs text-gray-500 mb-1">{wo.labName || "Unknown Lab"}</div>
          <div className="text-xs text-gray-400">{wo.categoryName ?? ""}</div>
        </button>
      ))}
    </div>
  )
}
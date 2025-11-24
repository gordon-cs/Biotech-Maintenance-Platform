"use client"

import React, { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

type Update = {
  id: number
  work_order_id: number
  author_id: string
  update_type: "comment" | "status_change"
  new_status?: string | null
  body: string
  created_at: string
  author?: {
    id: string
    full_name?: string | null
    email?: string | null
    role?: string | null
  }
}

type Props = {
  workOrderId: number
  onRefresh?: () => void
}

export default function WorkOrderUpdates({ workOrderId, onRefresh }: Props) {
  const [updates, setUpdates] = useState<Update[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadUpdates = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/work-order-updates?work_order_id=${workOrderId}`)
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Failed to load updates")
      }

      setUpdates(json.data || [])
    } catch (err) {
      console.error("Error loading updates:", err)
      setError(err instanceof Error ? err.message : "Failed to load updates")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUpdates()
  }, [workOrderId])

  // Helper to format date similar to past orders page
  const formatDateTime = (dateString: string) => {
    if (!dateString) return "N/A"
    try {
      const date = new Date(dateString)
      const formattedDate = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      const formattedTime = date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
      return `${formattedDate} ${formattedTime}`
    } catch (error) {
      return "Invalid date"
    }
  }

  const getStatusBadgeStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200"
      case "claimed":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "canceled":
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200"
      case "open":
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const formatStatus = (status: string) => {
    if (!status) return "Open"
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading updates...</p>
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded">
        <p className="text-sm text-red-800">Error: {error}</p>
      </div>
    )
  }

  if (updates.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500 bg-gray-50 rounded border border-gray-200">
        No updates yet. Be the first to comment!
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {updates.map((update) => (
        <div
          key={update.id}
          className={`p-4 rounded border ${
            update.update_type === "status_change"
              ? "bg-blue-50 border-blue-200"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">
                  {update.author?.full_name || update.author?.email || "Unknown User"}
                </span>
                {update.author?.role && (
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded border border-gray-200">
                    {update.author.role}
                  </span>
                )}
                {update.update_type === "status_change" && (
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded border border-blue-300">
                    Status Change
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-500 mb-2">
                {formatDateTime(update.created_at)}
              </p>

              {update.update_type === "status_change" && update.new_status && (
                <div className="mb-2">
                  <span className="text-sm text-gray-700">Changed status to: </span>
                  <span
                    className={`text-xs px-2 py-1 rounded border ${getStatusBadgeStyle(
                      update.new_status
                    )}`}
                  >
                    {formatStatus(update.new_status)}
                  </span>
                </div>
              )}

              <p className="text-sm text-gray-800 whitespace-pre-wrap">{update.body}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

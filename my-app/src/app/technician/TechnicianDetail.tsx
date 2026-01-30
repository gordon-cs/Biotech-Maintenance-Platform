"use client"

import React from "react"
import AddWorkOrderUpdate from "../components/AddWorkOrderUpdate"
import type { WorkOrder } from "./types"

type Props = {
  order: WorkOrder | null
  currentUserId?: string | null
  onAccept: (id: number) => void
  onCancel: (id: number) => void
  activeTab: "open" | "mine"
}

function formatSubmitted(date?: string | null) {
  if (!date) return ""
  try { return new Date(date).toLocaleString() } catch { return date }
}

export default function TechnicianDetail({ order, currentUserId, onAccept, onCancel, activeTab }: Props) {
  if (!order) return <div className="text-center text-gray-500 py-8">Select an order</div>

  return (
    <div className="border rounded-lg p-8 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-4xl font-bold leading-tight">{order.title}</h2>
        <span className="px-4 py-2 text-sm rounded-full bg-gray-100 border border-gray-200">{order.status ?? "Open"}</span>
      </div>

      <div className="text-sm text-gray-600 mb-4">Submitted on {formatSubmitted(order.created_at)}</div>

      {order.address && <div className="text-lg text-gray-800 mb-4">{order.address}</div>}

      <div className="mb-4">
        <div className="text-base font-medium">Category: <span className="font-semibold">{order.categoryName ?? "—"}</span></div>
      </div>

      <div className="mb-6">
        <span className="inline-block bg-yellow-50 text-yellow-900 px-4 py-2 rounded-full text-sm font-medium">Priority: {order.urgency ?? "normal"}</span>
      </div>

      <hr className="my-6 border-t border-gray-200" />

      <div className="mb-6">
        <p className="text-gray-700">{order.description}</p>
      </div>

      <div className="mt-8">
        {activeTab === "open" && (order.status || "").toLowerCase() === "open" && (
          <button
            onClick={() => onAccept(order.id)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
          >
            Accept Job
          </button>
        )}

        {activeTab === "mine" && (order.status || "").toLowerCase() === "claimed" && order.assigned_to === currentUserId && (
          <button onClick={() => onCancel(order.id)} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium">Cancel Job</button>
        )}
      </div>

      {/* always show updates component (comments/status changes) so AddWorkOrderUpdate is connected */}
      <div className="mt-8">
        <AddWorkOrderUpdate workOrderId={order.id} currentStatus={order.status ?? "open"} userRole="technician" />
      </div>
    </div>
  )
}
"use client"

import React, { useState } from "react"
import AddWorkOrderUpdate from "../components/AddWorkOrderUpdate"
import PaymentRequestPanel from "../components/PaymentRequestPanel"
import ConfirmationModal from "../components/ConfirmationModal"
import type { WorkOrder, TechnicianDetailProps } from "./types"

function formatSubmitted(date?: string | null) {
  if (!date) return ""
  try { return new Date(date).toLocaleString() } catch { return date }
}

const getStatusBadgeStyle = (status?: string | null) => {
  switch (status?.toLowerCase()) {
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'in_progress':
    case 'in progress':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'canceled':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'open':
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

const formatStatus = (status?: string | null) => {
  if (!status) return 'Open'
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const formatDateTime = (dateString?: string | null) => {
  if (!dateString) return "N/A"
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return "Invalid date"
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
  return `${formattedDate} ${formattedTime}`
}

export default function TechnicianDetail({
  order,
  currentUserId,
  onAccept,
  onCancel,
  activeTab,
  onStatusChange,
}: TechnicianDetailProps) {
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    action: "accept" | "cancel" | null
  }>({
    isOpen: false,
    action: null,
  })

  const handleAcceptClick = () => setConfirmModal({ isOpen: true, action: "accept" })
  const handleConfirm = () => {
    if (confirmModal.action === "accept") {
      if (order && onAccept) onAccept(order.id)
    } else if (confirmModal.action === "cancel") {
      if (order && onCancel) onCancel(order.id)
    }
    setConfirmModal({ isOpen: false, action: null })
  }
  const handleCloseModal = () => setConfirmModal({ isOpen: false, action: null })

  if (!order) return <div className="text-center text-gray-500 py-8">Select an order</div>

  return (
    <>
      <div className="border rounded-lg p-6 bg-white">
        <div className="mb-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="text-sm text-gray-500 mb-1">{order.labName ?? "Unknown Lab"}</div>
              <h2 className="text-3xl font-semibold leading-tight truncate">{order.title}</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 text-sm rounded-full border font-medium ${getStatusBadgeStyle(order.status ?? '')}`}>
                {formatStatus(order.status)}
              </span>

              <div className="flex gap-2">
                {/* Technicians: only allow Accept when open */}
                {activeTab === "open" && (order.status ?? "").toLowerCase() === "open" && (
                  <button
                    onClick={handleAcceptClick}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
                  >
                    Accept Job
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-500 mb-1">Submitted on {formatDateTime(order.created_at)}</div>
          <div className="text-sm text-gray-500 mb-2">Due Date: {formatDateTime(order.date)}</div>

          {order.address && <div className="text-sm text-gray-700 mb-2">{order.address}</div>}

          {/* Category + Equipment */}
          <div className="text-sm font-medium mb-2">
            Category: {
              (
                (order.category ?? order.categoryName ?? (order.category_id !== undefined && order.category_id !== null ? String(order.category_id) : "")) 
              ) || "—"
            }
          </div>

          {/* Brand / Model / Serial placed under Category to match manager layout */}
          <div className="mb-4 space-y-1">
            <div className="text-sm text-gray-700"><span className="font-medium">Brand:</span> {order.brand?.toString().trim() || "N/A"}</div>
            <div className="text-sm text-gray-700"><span className="font-medium">Model:</span> {order.model?.toString().trim() || "N/A"}</div>
            <div className="text-sm text-gray-700"><span className="font-medium">Serial Number:</span> {order.serial_number?.toString().trim() || "N/A"}</div>
          </div>

          {order.urgency && (
            <div className={`inline-block text-sm px-3 py-1 rounded-full mb-4 ${
              order.urgency?.toLowerCase() === "low" ? "bg-green-100 text-green-800" :
              order.urgency?.toLowerCase() === "high" ? "bg-red-100 text-red-800" :
              order.urgency?.toLowerCase() === "critical" ? "bg-red-300 text-red-900" :
              /* normal / medium / unknown */ "bg-gray-100 text-gray-800"
            }`}>
              Priority: {order.urgency}
            </div>
          )}
        </div>

        <div className="mb-6">
          <p className="text-gray-700 leading-relaxed">{order.description ?? "No description"}</p>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <AddWorkOrderUpdate
            workOrderId={
              (() => {
                const n = typeof order.id === "number" ? order.id : Number(order.id)
                return Number.isFinite(n) ? n : 0
              })()
            }
            currentStatus={order.status ?? "open"}
            userRole="technician"
            onStatusChange={onStatusChange}
          />
        </div>

        {order.status === 'completed' && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <PaymentRequestPanel
              selectedId={
                (() => {
                  const n = typeof order.id === "number" ? order.id : Number(order.id)
                  return Number.isFinite(n) ? n : 0
                })()
              }
               currentOrderStatus={order.status ?? "open"}
            />
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.action === "accept" ? "Accept this work order?" : "Cancel this work order?"}
        message={
          confirmModal.action === "accept"
            ? "You will be assigned to this work order."
            : "You will no longer be assigned to this work order."
        }
        confirmText={confirmModal.action === "accept" ? "Accept" : "Cancel"}
        backText="Back"
        onConfirm={handleConfirm}
        onClose={handleCloseModal}
        isDangerous={confirmModal.action === "cancel"}
      />
    </>
  )
}
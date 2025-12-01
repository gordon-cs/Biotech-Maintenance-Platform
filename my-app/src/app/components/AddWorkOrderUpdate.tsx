"use client"

import React, { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import WorkOrderUpdates from "./WorkOrderUpdates"

type Props = {
  workOrderId: number
  currentStatus?: string
  userRole?: string | null
}

export default function AddWorkOrderUpdate({ workOrderId, currentStatus = "open", userRole = null }: Props) {
  const [updateType, setUpdateType] = useState<"comment" | "status_change">("comment")
  const [body, setBody] = useState("")
  const [newStatus, setNewStatus] = useState("completed")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(userRole)
  
  // Fetch user role if not provided (only runs once when userRole is not provided)
  useEffect(() => {
    // Skip fetching if userRole is already provided
    if (userRole !== null) {
      setCurrentUserRole(userRole)
      return
    }
    
    // Only fetch if we don't have a role yet
    if (currentUserRole !== null) return
    
    let mounted = true
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && mounted) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()
        
        if (profile && mounted) {
          setCurrentUserRole(profile.role)
        }
      }
    }
    
    fetchUserRole()
    return () => { mounted = false }
  }, [userRole, currentUserRole]) // Only re-run if userRole or currentUserRole changes
  
  // Only technicians can change status, and only if work order is not already completed
  const isWorkOrderCompleted = currentStatus?.toLowerCase() === "completed"
  const allowStatusChange = currentUserRole === "technician" && !isWorkOrderCompleted

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setSuccess(null)

    if (!body.trim()) {
      setMessage("Please enter a message")
      return
    }

    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setMessage("You must sign in to post updates")
        setLoading(false)
        return
      }

      if (!session.access_token) {
        setMessage("Missing access token")
        setLoading(false)
        return
      }

      const payload = {
        work_order_id: workOrderId,
        update_type: updateType,
        body: body.trim(),
        ...(updateType === "status_change" ? { new_status: newStatus } : {}),
      }

      const response = await fetch("/api/work-order-updates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Failed to post update")
      }

      // Reset form
      setBody("")
      setUpdateType("comment")
      setNewStatus("completed")
      setSuccess("Update posted successfully!")
      
      // Trigger refresh of updates list
      setRefreshKey(prev => prev + 1)
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("Error posting update:", err)
      setMessage(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Add Update Form */}
      <div className="p-4 border rounded bg-white">
        <h3 className="font-semibold mb-4">Add Update</h3>
        
        {isWorkOrderCompleted && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-800">This work order is completed. No further updates can be made.</p>
          </div>
        )}
        
        {message && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-800">{message}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Update Type Toggle */}
          {allowStatusChange && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUpdateType("comment")}
                className={`flex-1 py-2 px-3 rounded border text-sm ${
                  updateType === "comment"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300"
                }`}
              >
                Comment
              </button>
              <button
                type="button"
                onClick={() => setUpdateType("status_change")}
                className={`flex-1 py-2 px-3 rounded border text-sm ${
                  updateType === "status_change"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300"
                }`}
              >
                Status Change
              </button>
            </div>
          )}

          {/* Status Selection - Only "completed" option */}
          {updateType === "status_change" && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded">
              <p className="text-sm text-gray-700">
                <strong>Status will be changed to:</strong> Completed
              </p>
            </div>
          )}

          {/* Message Body */}
          <label className="block">
            <span className="text-sm">
              {updateType === "status_change" ? "Reason for change" : "Comment"}
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                updateType === "status_change"
                  ? "Explain why the work is completed..."
                  : "Add a comment or update..."
              }
              rows={4}
              className="mt-1 block w-full border px-2 py-1 rounded"
              disabled={loading || isWorkOrderCompleted}
            />
          </label>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !body.trim() || isWorkOrderCompleted}
            className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {loading ? "Posting..." : "Post Update"}
          </button>
        </form>
      </div>

      {/* Updates List */}
      <div>
        <h3 className="font-semibold mb-3">Updates & Comments</h3>
        <WorkOrderUpdates key={refreshKey} workOrderId={workOrderId} />
      </div>
    </div>
  )
}

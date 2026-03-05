"use client"

import React, { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import WorkOrderUpdates from "./WorkOrderUpdates"

type Props = {
  workOrderId: number
  currentStatus?: string
  userRole?: string | null
  onStatusChange?: (newStatus: string) => void
}

export default function AddWorkOrderUpdate({ workOrderId, currentStatus = "open", userRole = null, onStatusChange }: Props) {
  const [updateType, setUpdateType] = useState<"comment" | "status_change">("comment")
  const [body, setBody] = useState("")
  const [newStatus, setNewStatus] = useState("completed")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(userRole)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type (images and PDFs only)
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
      if (!allowedTypes.includes(file.type)) {
        setMessage("Only images (JPEG, PNG, GIF, WebP) and PDFs are allowed")
        e.target.value = ''
        return
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage("File must be less than 5MB")
        e.target.value = ''
        return
      }
      setAttachmentFile(file)
      setMessage(null)
    }
  }

  const uploadAttachment = async (updateId: number): Promise<string | null> => {
    if (!attachmentFile) return null

    setUploadingFile(true)
    try {
      const fileExt = attachmentFile.name.split('.').pop()
      const fileName = `${updateId}-${Date.now()}.${fileExt}`
      
      const { data, error } = await supabase.storage
        .from('updates')
        .upload(fileName, attachmentFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('Storage upload error:', error)
        throw error
      }

      return fileName
    } catch (error) {
      console.error('Error uploading attachment:', error)
      throw error
    } finally {
      setUploadingFile(false)
    }
  }

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

      // Get the created update ID
      const result = await response.json()
      const updateId = result.data?.id

      // Upload attachment if provided
      if (attachmentFile && updateId) {
        try {
          const filePath = await uploadAttachment(updateId)
          
          // Update the work_order_update record with attachment_url
          if (filePath) {
            await supabase
              .from('work_order_updates')
              .update({ attachment_url: filePath })
              .eq('id', updateId)
          }
        } catch (error) {
          console.error('Failed to upload attachment:', error)
          setMessage('Update posted but file upload failed')
          setLoading(false)
          return
        }
      }

      // Reset form
      setBody("")
      setUpdateType("comment")
      setNewStatus("completed")
      setAttachmentFile(null)
      setSuccess("Update posted successfully!")
      
      // Trigger refresh of updates list
      setRefreshKey(prev => prev + 1)
      
      // Notify parent of status change if applicable
      if (updateType === "status_change" && onStatusChange) {
        onStatusChange(newStatus)
      }
      
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

          {/* File Attachment */}
          <div>
            <label className="block text-sm mb-1 font-medium text-gray-700">
              Attachment (optional, max 5MB - images or PDF)
            </label>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,application/pdf"
              onChange={handleFileChange}
              disabled={loading || uploadingFile || isWorkOrderCompleted}
              className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            />
            {attachmentFile && (
              <p className="text-xs text-gray-600 mt-1">
                Selected: {attachmentFile.name}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || uploadingFile || !body.trim() || isWorkOrderCompleted}
            className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {uploadingFile ? "Uploading..." : loading ? "Posting..." : "Post Update"}
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

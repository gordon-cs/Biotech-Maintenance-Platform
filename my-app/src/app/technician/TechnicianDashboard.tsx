"use client"

import React, { useEffect, useMemo, useState } from "react"
import useTechnician from "./hooks/useTechnician"
import TechnicianList from "./TechnicianList"
import TechnicianDetail from "./TechnicianDetail"
import type { WorkOrder } from "./types"

type Props = {
  onSelectWorkOrder?: (id: number | null) => void
}

export default function TechnicianDashboard({ onSelectWorkOrder }: Props) {
  const { workOrders, setWorkOrders, loading, error, currentUserId, categories, isVerified, loadWorkOrders, acceptJob, cancelJob } =
    useTechnician()

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<"open" | "mine">("open")
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<number | "">("")

  const handleStatusChange = (newStatus: string) => {
    if (selectedId) {
      setWorkOrders((prev) =>
        prev.map((wo) =>
          wo.id === selectedId ? { ...wo, status: newStatus } : wo
        )
      )
    }
  }

  useEffect(() => {
    void loadWorkOrders()
  }, [loadWorkOrders])
  // notify parent when selection changes
  useEffect(() => {
    if (onSelectWorkOrder) onSelectWorkOrder(selectedId)
  }, [selectedId, onSelectWorkOrder])

  const filtered = useMemo(() => {
    const tabFiltered = workOrders.filter((w) =>
      activeTab === "open" ? (w.status || "").toLowerCase() === "open" && !w.assigned_to : currentUserId ? w.assigned_to === currentUserId : false
    )

    return tabFiltered.filter((o) => {
      if (search) {
        const hay = ((o.title || "") + " " + (o.description || "") + " " + (o.labName || "")).toLowerCase()
        if (!hay.includes(search.toLowerCase())) return false
      }
      if (selectedCategory !== "" && o.category_id !== selectedCategory) return false
      return true
    })
  }, [workOrders, activeTab, search, selectedCategory, currentUserId])

  useEffect(() => {
    if (!filtered.length) { setSelectedId(null); return }
    if (!selectedId || !filtered.find((f) => f.id === selectedId)) setSelectedId(filtered[0].id)
  }, [filtered, selectedId])

  return (
    <div className="font-sans min-h-screen p-8 bg-gray-50 text-black">
      <main className="max-w-7xl mx-auto">
        {/* Verification Status Banner - Only show for pending or rejected states */}
        {isVerified === null && (
          <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-800">
                  <strong>Pending Verification:</strong> Your account is awaiting admin approval. You cannot accept work orders until verified.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {isVerified === false && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">
                  <strong>Verification Rejected:</strong> Your account verification was not approved. Please contact the administrator for more information.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 flex items-center gap-3">
          <button onClick={() => setActiveTab("open")} className={`px-4 py-2 rounded-full ${activeTab === "open" ? "bg-green-600 text-white" : "bg-gray-100"}`}>Open Requests</button>
          <button onClick={() => setActiveTab("mine")} className={`px-4 py-2 rounded-full ${activeTab === "mine" ? "bg-green-600 text-white" : "bg-gray-100"}`}>My Work Orders</button>
        </div>

        {error && <div className="text-red-600 mb-3">{error}</div>}

        <div className="bg-gray-50 rounded-lg p-4 mb-6 flex gap-4 items-center">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requests" className="flex-1 px-3 py-2 border rounded-md text-sm" />
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value === "" ? "" : Number(e.target.value))} className="px-3 py-2 border rounded-md text-sm">
            <option value="">Categories</option>
            {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4">
            <div className="h-[calc(100vh-420px)] min-h-[360px] max-h-[620px] overflow-y-auto border border-gray-200 rounded-lg bg-white p-3">
              <TechnicianList items={filtered} selectedId={selectedId} onSelect={(id) => setSelectedId(id)} loading={loading} />
            </div>
          </div>

          <div className="col-span-8">
            <TechnicianDetail
              order={workOrders.find((w) => w.id === selectedId) ?? null}
              currentUserId={currentUserId}
              onAccept={(id) => void acceptJob(id)}
              onCancel={(id) => void cancelJob(id)}
              activeTab={activeTab}
              onStatusChange={handleStatusChange}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
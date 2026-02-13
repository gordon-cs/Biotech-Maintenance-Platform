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
  const { workOrders, setWorkOrders, loading, error, currentUserId, categories, loadWorkOrders, acceptJob, cancelJob } =
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
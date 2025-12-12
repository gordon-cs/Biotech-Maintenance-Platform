"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

/* UI types */
type WorkOrderUpdate = {
  id: number
  work_order_id: number
  author_id?: string | null
  update_type?: string | null
  new_status?: string | null
  body?: string | null
  created_at?: string | null
}

type WorkOrder = {
  id: number
  created_by?: string | null
  lab?: number | null
  title?: string | null
  description?: string | null
  equipment?: string | null
  urgency?: string | null
  status?: string | null
  date?: string | null
  assigned_to?: string | null
  created_at?: string | null
  updated_at?: string | null
  category_id?: number | null
  address_id?: number | null
  updates?: WorkOrderUpdate[]
}

/* DB row shapes returned by Supabase (bigint may be string) */
type DBWorkOrderRow = {
  id: number | string
  created_by?: string | null
  lab?: number | null
  title?: string | null
  description?: string | null
  equipment?: string | null
  urgency?: string | null
  status?: string | null
  date?: string | null
  assigned_to?: string | null
  created_at?: string | null
  updated_at?: string | null
  category_id?: number | null
  address_id?: number | null
}

type DBWorkOrderUpdateRow = {
  id: number | string
  work_order_id: number | string
  author_id?: string | null
  update_type?: string | null
  new_status?: string | null
  body?: string | null
  created_at?: string | null
}

const STATUS_OPTIONS = [
  "open",
  "claimed",
  "completed",
  "canceled"
]

export default function AdminWorkOrdersPage() {
  const [rows, setRows] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [deleting, setDeleting] = useState<Record<number, boolean>>({})
  const [changing, setChanging] = useState<Record<number, boolean>>({})
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const res = await supabase
        .from("work_orders")
        .select(
          `id, created_by, lab, title, description, equipment, urgency, status, date, assigned_to, created_at, updated_at, category_id, address_id`
        )
        .order("id", { ascending: true })

      // cast the returned data to the DB row type
      const workOrders = (res.data as DBWorkOrderRow[] | null)

      if (res.error) throw res.error

      const ids: number[] = (workOrders ?? []).map((w) => Number(w.id))
      let updatesRows: DBWorkOrderUpdateRow[] = []
      if (ids.length) {
        const updRes = await supabase
          .from("work_order_updates")
          .select("id, work_order_id, author_id, update_type, new_status, body, created_at")
          .in("work_order_id", ids)
          .order("created_at", { ascending: true })

        if (updRes.error) throw updRes.error
        updatesRows = (updRes.data as DBWorkOrderUpdateRow[]) ?? []
      }

      const updatesMap = new Map<number, WorkOrderUpdate[]>()
      updatesRows.forEach((u) => {
        const wid = Number(u.work_order_id)
        const list = updatesMap.get(wid) ?? []
        list.push({
          id: Number(u.id),
          work_order_id: wid,
          author_id: u.author_id ?? null,
          update_type: u.update_type ?? null,
          new_status: u.new_status ?? null,
          body: u.body ?? null,
          created_at: u.created_at ?? null
        })
        updatesMap.set(wid, list)
      })

      const enriched: WorkOrder[] = (workOrders ?? []).map((w) => {
        const idNum = Number(w.id)
        return {
          id: idNum,
          created_by: w.created_by ?? null,
          lab: w.lab ?? null,
          title: w.title ?? null,
          description: w.description ?? null,
          equipment: w.equipment ?? null,
          urgency: w.urgency ?? null,
          status: w.status ?? null,
          date: w.date ?? null,
          assigned_to: w.assigned_to ?? null,
          created_at: w.created_at ?? null,
          updated_at: w.updated_at ?? null,
          category_id: w.category_id ?? null,
          address_id: w.address_id ?? null,
          updates: updatesMap.get(idNum) ?? []
        }
      })

      setRows(enriched)
    } catch (err: unknown) {
      console.error(err)
      setMessage((err as { message?: string })?.message ?? "Failed to load work orders")
    } finally {
      setLoading(false)
    }
  }

  const changeStatus = async (woId: number, newStatus: string) => {
    setChanging((s) => ({ ...s, [woId]: true }))
    setMessage(null)
    try {
      const payload = { status: newStatus, updated_at: new Date().toISOString() } as Partial<DBWorkOrderRow>
      const res = await supabase
        .from("work_orders")
        .update(payload)
        .eq("id", woId)
        .select()
        .maybeSingle()

      if (res.error) throw res.error
      const updated = res.data as DBWorkOrderRow | null

      setRows((prev) => prev.map((r) => (r.id === woId ? { ...r, status: updated?.status ?? newStatus } : r)))
    } catch (err: unknown) {
      console.error(err)
      setMessage((err as { message?: string })?.message ?? "Unable to change status")
    } finally {
      setChanging((s) => ({ ...s, [woId]: false }))
    }
  }

  const deleteWorkOrder = async (woId: number) => {
    if (!confirm("Delete this work order and all its updates? This cannot be undone.")) return
    setDeleting((s) => ({ ...s, [woId]: true }))
    setMessage(null)
    try {
      const delUpd = await supabase.from("work_order_updates").delete().eq("work_order_id", woId)
      if (delUpd.error) throw delUpd.error

      const delWo = await supabase.from("work_orders").delete().eq("id", woId)
      if (delWo.error) throw delWo.error

      setRows((prev) => prev.filter((r) => r.id !== woId))
    } catch (err: unknown) {
      console.error(err)
      setMessage((err as { message?: string })?.message ?? "Failed to delete work order")
    } finally {
      setDeleting((s) => ({ ...s, [woId]: false }))
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Manage Work Orders</h2>
        <div>
          <button onClick={loadAll} className="px-3 py-1 border rounded">
            Refresh
          </button>
        </div>
      </div>

      {message && <div className="mb-3 text-sm text-red-600">{message}</div>}

      {loading ? (
        <div>Loading...</div>
      ) : (
        <ul className="space-y-3">
          {rows.length === 0 && <li className="text-sm text-gray-600">No work orders found.</li>}
          {rows.map((r) => (
            <li key={r.id} className="p-3 border rounded">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="font-medium">{r.title ?? `#${r.id}`}</div>
                  <div className="text-sm text-gray-600">{r.description ?? ""}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Created: {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}{" "}
                    {r.updated_at ? `• Updated: ${new Date(r.updated_at).toLocaleString()}` : ""}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Equipment: {r.equipment ?? "—"} • Urgency: {r.urgency ?? "—"}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <select
                    value={r.status ?? "open"}
                    onChange={(e) => changeStatus(r.id, e.target.value)}
                    className="px-2 py-1 border rounded"
                    disabled={!!changing[r.id]}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  <div className="text-sm text-gray-600">Assigned: {r.assigned_to ?? "none"}</div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setExpanded((s) => ({ ...s, [r.id]: !s[r.id] }))}
                      className="px-2 py-1 border rounded"
                    >
                      {expanded[r.id] ? "Hide updates" : `Show updates (${r.updates?.length ?? 0})`}
                    </button>

                    <button
                      onClick={() => deleteWorkOrder(r.id)}
                      disabled={!!deleting[r.id]}
                      className="px-2 py-1 bg-red-600 text-white rounded disabled:opacity-50"
                    >
                      {deleting[r.id] ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </div>

              {expanded[r.id] && (
                <div className="mt-3 border-t pt-3">
                  {r.updates && r.updates.length ? (
                    <ul className="space-y-2">
                      {r.updates.map((u) => (
                        <li key={u.id} className="p-2 bg-gray-50 rounded">
                          <div className="text-xs text-gray-600">
                            By: {u.author_id ?? "unknown"} • {u.created_at ? new Date(u.created_at).toLocaleString() : ""}
                            {u.update_type ? ` • ${u.update_type}` : ""} {u.new_status ? ` • status: ${u.new_status}` : ""}
                          </div>
                          <div className="mt-1 text-sm">{u.body ?? ""}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-gray-600">No updates/comments for this work order.</div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
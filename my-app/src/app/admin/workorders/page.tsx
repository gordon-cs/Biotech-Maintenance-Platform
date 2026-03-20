"use client"

import { Fragment, useEffect, useState, useMemo } from "react"
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

// explicit profile row type 
type ProfileRow = {
  id: string
  full_name?: string | null
  email?: string | null
  role?: string | null
  is_technician?: boolean | null
}

const STATUS_OPTIONS = [
  "open",
  "claimed",
  "completed",
  "canceled"
]

export default function AdminWorkOrdersPage() {
  const [rows, setRows] = useState<WorkOrder[]>([])
  const [technicians, setTechnicians] = useState<Array<{ id: string; full_name?: string | null; email?: string | null }>>([])
  const [profileMap, setProfileMap] = useState<Record<string, string>>({})
  const techMap = useMemo(() => {
    return Object.fromEntries(technicians.map(t => [t.id, t.full_name ?? t.email ?? t.id]))
  }, [technicians])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [deleting, setDeleting] = useState<Record<number, boolean>>({})
  const [changing, setChanging] = useState<Record<number, boolean>>({})
  const [assigning, setAssigning] = useState<Record<number, boolean>>({})
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

      // gather profile ids used by work orders and updates (authors, creators, assignees)
      const profIdSet = new Set<string>()
      ;(workOrders || []).forEach((w) => {
        if (w.created_by) profIdSet.add(String(w.created_by))
        if (w.assigned_to) profIdSet.add(String(w.assigned_to))
      })
      updatesRows.forEach((u) => { if (u.author_id) profIdSet.add(String(u.author_id)) })

      if (profIdSet.size) {
        const profIds = Array.from(profIdSet)
        const profRes = await supabase.from("profiles").select("id, full_name, email").in("id", profIds)
        if (!profRes.error) {
          const profRows = (profRes.data || []) as ProfileRow[]
          const map: Record<string, string> = {}
          for (const p of profRows) {
            map[String(p.id)] = p.full_name?.trim() ? p.full_name : (p.email ?? String(p.id))
          }
          setProfileMap(map)
        }
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
      // fetch profiles (typed)
      const techRes = await supabase
        .from("profiles")
        .select("id, full_name, email, role, is_technician") // include column
        .order("full_name", { ascending: true })
      if (!techRes.error) {
        const profiles = (techRes.data || []) as ProfileRow[]
        // prefer explicit technician markers
        let techRows = profiles.filter((p) => p.role === "technician" || p.is_technician === true)
        if (techRows.length === 0) {
          techRows = profiles.filter((p) => typeof p.role === "string" && p.role!.toLowerCase().includes("tech"))
        }
        if (techRows.length === 0) techRows = profiles
        setTechnicians(
          techRows.map((p) => ({
            id: String(p.id),
            full_name: p.full_name ?? null,
            email: p.email ?? null,
          }))
        )
      } else {
        // surface the error to UI so you notice immediately
        console.warn("profiles fetch error:", techRes.error)
        setTechnicians([])
      }
    } catch (err: unknown) {
      console.error(err)
      setMessage((err as { message?: string })?.message ?? "Failed to load work orders")
    } finally {
      setLoading(false)
    }
  }

  const assignWorkOrder = async (woId: number, techId: string) => {
    // ignore placeholder empty selection
    if (techId === "") return
    setAssigning((s) => ({ ...s, [woId]: true }))
    setMessage(null)
    try {
      // support explicit "none" to unassign (set assigned_to = null and reopen)
      const payload: Partial<DBWorkOrderRow> =
        techId === "none"
          ? { assigned_to: null, status: "open", updated_at: new Date().toISOString() }
          : { assigned_to: techId, status: "claimed", updated_at: new Date().toISOString() }
      const res = await supabase.from("work_orders").update(payload).eq("id", woId).select().maybeSingle()
      if (res.error) throw res.error
      const updated = res.data as DBWorkOrderRow | null
      setRows((prev) =>
        prev.map((r) =>
          r.id === woId
            ? {
                ...r,
                assigned_to: techId === "none" ? null : (updated?.assigned_to ?? techId),
                status: updated?.status ?? (techId === "none" ? "open" : "claimed"),
              }
             : r
        )
      )
    } catch (err: unknown) {
      console.error(err)
      setMessage((err as { message?: string })?.message ?? "Failed to assign work order")
    } finally {
      setAssigning((s) => ({ ...s, [woId]: false }))
    }
  }

  const changeStatus = async (woId: number, newStatus: string) => {
    setChanging((s) => ({ ...s, [woId]: true }))
    setMessage(null)
    try {
      // if reopening to "open", clear the assignee
      const payload = {
        status: newStatus,
        updated_at: new Date().toISOString(),
        ...(newStatus === "open" ? { assigned_to: null } : {}),
      } as Partial<DBWorkOrderRow>
      const res = await supabase
        .from("work_orders")
        .update(payload)
        .eq("id", woId)
        .select()
        .maybeSingle()

      if (res.error) throw res.error
      const updated = res.data as DBWorkOrderRow | null

      setRows((prev) =>
        prev.map((r) =>
          r.id === woId
            ? {
                ...r,
                status: updated?.status ?? newStatus,
                // if reopened to open, ensure assigned_to is cleared
                assigned_to: newStatus === "open" ? null : (updated?.assigned_to ?? r.assigned_to),
              }
            : r
        )
      )
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
        <h2 className="text-2xl font-semibold">Manage Work Orders</h2>
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
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm table-auto">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">ID</th>
                <th className="px-4 py-3 font-semibold">Title / Description</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Assigned</th>
                <th className="px-4 py-3 font-semibold">Assign to</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No work orders found.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3 align-top text-xs font-mono">#{r.id}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.title ?? "Untitled"}</div>
                        <div className="text-sm text-gray-600">{r.description ?? ""}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Equipment: {r.equipment ?? "—"} • Urgency: {r.urgency ?? "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
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
                      </td>
                      <td className="px-4 py-3 align-top">
                        {r.assigned_to ? (techMap[r.assigned_to] ?? profileMap[String(r.assigned_to)] ?? r.assigned_to) : "none"}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <select
                          value={r.assigned_to ?? ""}
                          onChange={(e) => assignWorkOrder(r.id, e.target.value)}
                          className="px-2 py-1 border rounded text-sm"
                          disabled={!!assigning[r.id]}
                        >
                          <option value="">— Select technician —</option>
                          <option value="none">— Unassign —</option>
                          {technicians.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.full_name ?? t.email ?? t.id}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-gray-500">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col items-start gap-2">
                          <button
                            onClick={() => setExpanded((s) => ({ ...s, [r.id]: !s[r.id] }))}
                            className="px-2 py-1 border rounded text-xs"
                          >
                            {expanded[r.id] ? "Hide updates" : `Show updates (${r.updates?.length ?? 0})`}
                          </button>
                          <button
                            onClick={() => deleteWorkOrder(r.id)}
                            disabled={!!deleting[r.id]}
                            className="px-2 py-1 bg-red-600 text-white rounded text-xs disabled:opacity-50"
                          >
                            {deleting[r.id] ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expanded[r.id] && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="px-4 py-3">
                          {r.updates && r.updates.length ? (
                            <ul className="space-y-2">
                              {r.updates.map((u) => (
                                <li key={u.id} className="p-2 bg-white rounded">
                                  <div className="text-xs text-gray-600">
                                    By: {profileMap[String(u.author_id ?? "")] ?? (u.author_id ?? "unknown")} • {u.created_at ? new Date(u.created_at).toLocaleString() : ""}
                                    {u.update_type ? ` • ${u.update_type}` : ""} {u.new_status ? ` • status: ${u.new_status}` : ""}
                                    {/* show work order creator / lab manager */}
                                    {` • Work order by: ${profileMap[String(r.created_by ?? "")] ?? (r.created_by ?? "unknown")}`}
                                  </div>
                                  <div className="mt-1 text-sm">{u.body ?? ""}</div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-sm text-gray-600">No updates/comments for this work order.</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
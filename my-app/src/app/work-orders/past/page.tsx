"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"

type LabRow = {
  id: number
  name?: string | null
  address?: string | null
  address2?: string | null
  city?: string | null
  state?: string | null
  zipcode?: string | null
  manager_id?: string | null
}

type OrderRow = {
  id: number
  title?: string | null
  category_id?: number | null
  lab?: number | null
  address_id?: number | null
  created_at?: string | null
}

type CategoryRow = {
  id: number
  name?: string | null
}

type AddressRow = {
  id: number
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
  zipcode?: string | null
}

type DisplayRow = {
  id: string
  title: string
  address: string
  category: string
}

/* Small runtime helpers to turn unknown responses into typed rows without `any` */
const toNumber = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : NaN)
const toStringOrNull = (v: unknown) => (v == null ? null : String(v))

export default function PastOrdersPage() {
  const [orders, setOrders] = useState<DisplayRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        // get current user
        const { data: authData, error: authErr } = await supabase.auth.getUser()
        if (authErr) throw authErr
        const userId = authData?.user?.id
        if (!userId) {
          setError("Not authenticated")
          setOrders([])
          return
        }

        // get labs managed by user (no generic here -> runtime-checked)
        const labsRes = await supabase.from("labs").select("id, name, address, address2, city, state, zipcode, manager_id").eq("manager_id", userId)
        if (labsRes.error) throw labsRes.error
        const rawLabs = Array.isArray(labsRes.data) ? labsRes.data : []
        const labRows: LabRow[] = rawLabs.map((r) => ({
          id: toNumber((r as Record<string, unknown>).id),
          name: toStringOrNull((r as Record<string, unknown>).name),
          address: toStringOrNull((r as Record<string, unknown>).address),
          address2: toStringOrNull((r as Record<string, unknown>).address2),
          city: toStringOrNull((r as Record<string, unknown>).city),
          state: toStringOrNull((r as Record<string, unknown>).state),
          zipcode: toStringOrNull((r as Record<string, unknown>).zipcode),
          manager_id: toStringOrNull((r as Record<string, unknown>).manager_id),
        }))

        const labIds = labRows.map((l) => l.id).filter((id) => !Number.isNaN(id))
        if (labIds.length === 0) {
          setOrders([])
          return
        }

        // fetch work_orders for those labs (select known columns)
        const ordersRes = await supabase.from("work_orders").select("id, title, category_id, lab, address_id, created_at").in("lab", labIds).order("created_at", { ascending: false })
        if (ordersRes.error) throw ordersRes.error
        const rawOrders = Array.isArray(ordersRes.data) ? ordersRes.data : []
        const woRows: OrderRow[] = rawOrders.map((r) => ({
          id: toNumber((r as Record<string, unknown>).id),
          title: toStringOrNull((r as Record<string, unknown>).title),
          category_id: (() => {
            const v = (r as Record<string, unknown>).category_id
            const n = toNumber(v)
            return Number.isNaN(n) ? null : n
          })(),
          lab: (() => {
            const v = (r as Record<string, unknown>).lab
            const n = toNumber(v)
            return Number.isNaN(n) ? null : n
          })(),
          address_id: (() => {
            const v = (r as Record<string, unknown>).address_id
            const n = toNumber(v)
            return Number.isNaN(n) ? null : n
          })(),
          created_at: toStringOrNull((r as Record<string, unknown>).created_at),
        }))

        // resolve category names
        const catIds = Array.from(new Set(woRows.map((w) => w.category_id).filter((v): v is number => typeof v === "number")))
        const categoryMap: Record<number, string> = {}
        if (catIds.length) {
          const catRes = await supabase.from("categories").select("id, name").in("id", catIds)
          if (catRes.error) throw catRes.error
          const rawCats = Array.isArray(catRes.data) ? catRes.data : []
          for (const c of rawCats) {
            const id = toNumber((c as Record<string, unknown>).id)
            if (!Number.isNaN(id)) categoryMap[id] = toStringOrNull((c as Record<string, unknown>).name) ?? "N/A"
          }
        }

        // collect address_ids referenced by work orders
        const addressIds = Array.from(new Set(woRows.map((r) => r.address_id).filter((v): v is number => typeof v === "number")))
        const addressMap: Record<number, string> = {}
        if (addressIds.length) {
          const addrRes = await supabase.from("addresses").select("id, line1, line2, city, state, zipcode").in("id", addressIds)
          if (addrRes.error) throw addrRes.error
          const rawAddrs = Array.isArray(addrRes.data) ? addrRes.data : []
          for (const a of rawAddrs) {
            const id = toNumber((a as Record<string, unknown>).id)
            if (Number.isNaN(id)) continue
            const line1 = toStringOrNull((a as Record<string, unknown>).line1)
            const line2 = toStringOrNull((a as Record<string, unknown>).line2)
            const city = toStringOrNull((a as Record<string, unknown>).city)
            const state = toStringOrNull((a as Record<string, unknown>).state)
            const zipcode = toStringOrNull((a as Record<string, unknown>).zipcode)
            const parts = [line1, line2, city, state, zipcode].filter(Boolean)
            addressMap[id] = parts.length ? parts.join(", ") : "N/A"
          }
        }

        // lab map for fallback address
        const labMap: Record<number, string> = {}
        for (const l of labRows) {
          if (Number.isNaN(l.id)) continue
          const parts = [l.address, l.address2, l.city, l.state, l.zipcode].filter(Boolean)
          labMap[l.id] = parts.length ? parts.join(", ") : "N/A"
        }

        // build final display rows (title, address, category)
        const display: DisplayRow[] = woRows.map((r) => {
          const id = String(r.id)
          const title = r.title ?? "Untitled"
          let addr = "N/A"
          if (r.address_id != null && addressMap[r.address_id]) addr = addressMap[r.address_id]
          else if (r.lab != null && labMap[r.lab]) addr = labMap[r.lab]
          const category = r.category_id != null ? categoryMap[r.category_id] ?? "N/A" : "N/A"
          return { id, title, address: addr, category }
        })

        if (mounted) setOrders(display)
      } catch (err: unknown) {
        let msg = "Unknown error"
        if (err instanceof Error) msg = err.message
        else if (err && typeof err === "object") {
          try {
            const e = err as Record<string, unknown>
            if (typeof e.message === "string") msg = e.message
            else msg = JSON.stringify(e, Object.getOwnPropertyNames(e), 2)
          } catch {
            msg = String(err)
          }
        } else {
          msg = String(err)
        }
        if (mounted) setError(msg)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Past Orders</h1>
          <div>
            <Link href="/manager" className="inline-block px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm">
              Back to Dashboard
            </Link>
          </div>
        </header>

        {loading && <div className="text-sm text-gray-600">Loading...</div>}
        {error && <div className="text-sm text-red-600 mb-4">Error: {error}</div>}

        {!loading && !error && orders.length === 0 && <div className="text-sm text-gray-600">No work orders found for your lab(s).</div>}

        <div className="space-y-3 mt-4">
          {orders.map((o) => (
            <div key={o.id} className="border rounded p-4 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-lg font-semibold">{o.title}</div>
                  <div className="text-sm text-gray-500 mt-1">{o.address}</div>
                </div>
                <div className="text-sm text-gray-500">{o.category}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
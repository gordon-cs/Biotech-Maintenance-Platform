"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"

type WorkOrderRow = {
  id: string
  title?: string | null
  category?: string | null
  lab?: number | null
  address_id?: number | null
  created_at?: string | null
}

export default function PastOrdersPage() {
  const [orders, setOrders] = useState<Array<{ id: string; title: string; address: string; category: string }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        // current user
        const { data: authData, error: authErr } = await supabase.auth.getUser()
        if (authErr) throw authErr
        const userId = authData?.user?.id
        if (!userId) {
          setError("Not authenticated")
          setOrders([])
          return
        }

        // get labs (with address fields) managed by user
        const labsRes = await supabase
          .from("labs")
          .select("id, name, address, address2, city, state, zipcode")
          .eq("manager_id", userId)
        if (labsRes.error) throw labsRes.error
        const labRows = labsRes.data ?? []
        const labIds = labRows.map((r: any) => Number(r.id))

        if (labIds.length === 0) {
          setOrders([])
          return
        }

        // fetch work_orders for those labs — select category_id instead of non-existent `category`
        const ordersRes = await supabase
          .from("work_orders")
          .select("id, title, category_id, lab, address_id, created_at")
          .in("lab", labIds)
          .order("created_at", { ascending: false })

        if (ordersRes.error) throw ordersRes.error

        // normalize rows
        const woRows = (ordersRes.data ?? []).map((r: any) => ({
          id: String(r.id),
          title: r.title ?? "Untitled",
          category_id: r.category_id ?? null,
          lab: r.lab ?? null,
          address_id: r.address_id ?? null,
          created_at: r.created_at ?? null,
        }))

        // resolve category names
        const catIds = Array.from(new Set(woRows.map((w) => w.category_id).filter(Boolean) as number[]))
        const categoryMap: Record<number, string> = {}
        if (catIds.length) {
          const catRes = await supabase.from("categories").select("id,name").in("id", catIds)
          if (!catRes.error) {
            for (const c of catRes.data ?? []) categoryMap[Number(c.id)] = c.name
          }
        }

        // build final display rows (title, address, category)
        const display = woRows.map((r) => {
          const addr = "N/A" // 기존 주소 매핑 로직을 그대로 사용하세요 (address_id / lab fallback)
          return {
            id: r.id,
            title: r.title,
            address: addr,
            category: r.category_id ? categoryMap[r.category_id] ?? "N/A" : "N/A",
          }
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

        {!loading && !error && orders.length === 0 && (
          <div className="text-sm text-gray-600">No work orders found for your lab(s).</div>
        )}

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
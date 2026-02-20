"use client"

import { useCallback, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import type { DBWorkOrderRow, WorkOrder } from "../types"

/* local typed shape for addresses returned from DB */
type AddressRow = {
  id: number | string
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
  zipcode?: string | null
}

export default function useTechnician() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isVerified, setIsVerified] = useState<boolean | null>(null)

  const [labs, setLabs] = useState<Array<{ id: number; name: string }>>([])
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([])

  const loadWorkOrders = useCallback(
    async (
      labsData?: Array<{ id: number; name: string }>,
      categoriesData?: Array<{ id: number; name: string }>,
      sortBy: "recent" | "oldest" = "recent"
    ) => {
      setLoading(true)
      setError(null)
      try {
        // ensure we know the current user before filtering "mine"
        let userId: string | null = null
        try {
          const sessionRes = await supabase.auth.getSession()
          userId = sessionRes.data?.session?.user?.id ?? null
          setCurrentUserId(userId)
          
          // Check if technician is verified
          if (userId) {
            const { data: techData, error: techError } = await supabase
              .from('technicians')
              .select('verified')
              .eq('id', userId)
              .single()

            if (!techError && techData) {
              setIsVerified(techData.verified)
            } else if (techError) {
              console.warn("Failed to load technician verification status:", techError)
              setError(prev => prev ?? "Failed to load technician verification status")
            }
          }
        } catch (err) {
          console.warn("Failed to load auth session:", err)
        }

        // fetch work orders
        const res = await supabase
          .from("work_orders")
          .select(
            "id,title,description,date,category_id,lab,created_by,status,created_at,address_id,assigned_to,urgency"
          )
          .order("created_at", { ascending: sortBy === "oldest" })

        if (res.error) throw res.error

        const rows = (res.data as DBWorkOrderRow[]) ?? []

        // If caller didn't pass labs/categories, fetch them here
        type LabRow = { id: number | string; name?: string | null }
        type CategoryRow = { id: number | string; name?: string | null }

        const labs = labsData ?? (await (async () => {
          const { data, error } = await supabase.from("labs").select("id,name")
          if (error) { console.warn("Failed to load labs:", error); return [] as LabRow[] }
          return (data as LabRow[]) ?? []
        })())

        const cats = categoriesData ?? (await (async () => {
          const { data, error } = await supabase.from("categories").select("id,name")
          if (error) { console.warn("Failed to load categories:", error); return [] as CategoryRow[] }
          return (data as CategoryRow[]) ?? []
        })())

        // persist for UI (so dashboard can populate selects)
        setLabs(labs.map(l => ({ id: Number(l.id), name: l.name ?? "" })))
        setCategories(cats.map(c => ({ id: Number(c.id), name: c.name ?? "" })))

        const labsMap = new Map<number, string>()
        labs.forEach((l) => { if (l?.id != null) labsMap.set(Number(l.id), l.name ?? "") })

        const catsMap = new Map<number, string>()
        cats.forEach((c) => { if (c?.id != null) catsMap.set(Number(c.id), c.name ?? "") })

        // addresses
        const addressIds = rows
          .map((r) => r.address_id)
          .filter((v): v is number => v != null)
          .map(Number)
        const addressMap = new Map<number, string>()

        if (addressIds.length > 0) {
          const addressRes = await supabase
            .from("addresses")
            .select("id, line1, line2, city, state, zipcode")
            .in("id", addressIds)

          if (addressRes.error) throw addressRes.error

          const addressData = (addressRes.data as AddressRow[]) ?? []
          addressData.forEach((addr) => {
            const parts = [addr.line1, addr.city, addr.state, addr.zipcode].filter(Boolean)
            addressMap.set(Number(addr.id), parts.join(", "))
          })
        }

        const enriched: WorkOrder[] = rows.map((wo) => {
          const id = Number(wo.id)
          const categoryId = wo.category_id != null ? Number(wo.category_id) : null
          return {
            id,
            title: wo.title ?? null,
            description: wo.description ?? null,
            date: wo.date ?? null,
            category_id: categoryId,
            lab: wo.lab != null ? Number(wo.lab) : null,
            created_by: wo.created_by ?? null,
            status: wo.status ?? null,
            assigned_to: wo.assigned_to ?? null,
            created_at: wo.created_at ?? null,
            address_id: wo.address_id != null ? Number(wo.address_id) : null,
            address: wo.address_id ? addressMap.get(Number(wo.address_id)) ?? null : null,
            labName: wo.lab ? labsMap.get(Number(wo.lab)) ?? null : null,
            categoryName: categoryId ? catsMap.get(categoryId) ?? null : null,
            urgency: wo.urgency ?? null,
            updates: []
          }
        })

        setWorkOrders(enriched)
      } catch (e: unknown) {
        setError((e as { message?: string })?.message ?? "Failed to load")
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const acceptJob = useCallback(
    async (woId: number) => {
      setLoading(true)
      setError(null)
      try {
        const sessionRes = await supabase.auth.getSession()
        const session = sessionRes.data?.session ?? null
        const userId = session?.user?.id ?? null
        if (!userId) throw new Error("No session")

        setCurrentUserId(userId)

        // Check if technician is verified before accepting jobs
        const { data: techData, error: techError } = await supabase
          .from('technicians')
          .select('verified')
          .eq('id', userId)
          .single()
        
        if (techError) throw new Error("Failed to verify technician status")

        // techData.verified semantics:
        //   true  => verified technician, can accept jobs
        //   null  => pending verification
        //   false => verification rejected
        if (!techData || typeof techData.verified === "undefined") {
          throw new Error("Unable to determine your verification status. Please contact an administrator.")
        }

        if (techData.verified === null) {
          throw new Error("Your account is pending verification by an admin. You will be able to accept work orders once it has been approved.")
        }

        if (techData.verified === false) {
          throw new Error("Your account verification request has been rejected. Please contact an admin if you believe this is an error.")
        }
        const { error } = await supabase
          .from("work_orders")
          .update({ status: "claimed", assigned_to: userId } as Partial<DBWorkOrderRow>)
          .eq("id", woId)

        if (error) throw error

        await loadWorkOrders()
      } catch (e: unknown) {
        setError((e as { message?: string })?.message ?? "Failed to accept job")
      } finally {
        setLoading(false)
      }
    },
    [loadWorkOrders]
  )

  const cancelJob = useCallback(
    async (woId: number) => {
      setLoading(true)
      setError(null)
      try {
        const { error } = await supabase
          .from("work_orders")
          .update({ status: "open", assigned_to: null } as Partial<DBWorkOrderRow>)
          .eq("id", woId)
        if (error) throw error
        await loadWorkOrders()
      } catch (e: unknown) {
        setError((e as { message?: string })?.message ?? "Failed to cancel job")
      } finally {
        setLoading(false)
      }
    },
    [loadWorkOrders]
  )

  return { workOrders, setWorkOrders, loading, error, currentUserId, labs, categories, isVerified, loadWorkOrders, acceptJob, cancelJob }
}
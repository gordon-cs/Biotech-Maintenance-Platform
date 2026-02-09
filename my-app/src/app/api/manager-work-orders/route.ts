import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const labIds = Array.isArray(body.labIds) ? body.labIds : []
    if (!labIds.length) return NextResponse.json({ data: [] })

    // fetch work orders
    const { data: workOrders, error: woError } = await serviceClient
      .from("work_orders")
      .select("id, title, description, category_id, lab, created_at, urgency, status, date, assigned_to")
      .in("lab", labIds)
      .order("created_at", { ascending: false })

    if (woError) {
      return NextResponse.json({ error: woError.message }, { status: 500 })
    }

    const rows = workOrders || []

    // collect assigned ids
    const assignedIds = Array.from(
      new Set(rows.map((r: any) => r.assigned_to).filter(Boolean))
    ).map(String)

    let profilesMap: Record<string, { id: string; full_name?: string | null; email?: string | null }> = {}

    if (assignedIds.length) {
      const { data: profilesData, error: profilesErr } = await serviceClient
        .from("profiles")
        .select("id, full_name, email")
        .in("id", assignedIds)

      if (!profilesErr && profilesData) {
        for (const p of profilesData) {
          profilesMap[String(p.id)] = { id: String(p.id), full_name: p.full_name ?? null, email: p.email ?? null }
        }
      }
    }

    // attach assigned profile info (array for compatibility with client)
    const withAssigned = (rows || []).map((r: any) => {
      const assignedInfo = r.assigned_to ? (profilesMap[String(r.assigned_to)] ? [profilesMap[String(r.assigned_to)]] : []) : []
      return { ...r, assigned: assignedInfo }
    })

    return NextResponse.json({ data: withAssigned })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error"
    // eslint-disable-next-line no-console
    console.error("manager-work-orders error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
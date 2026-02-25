import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

type WorkOrderRowServer = {
  id: number
  title?: string | null
  description?: string | null
  equipment?: string | null
  category_id?: number | null
  lab: number
  created_at?: string | null
  urgency?: string | null
  status?: string | null
  date?: string | null
  assigned_to?: string | null
}

type ProfileRow = {
  id: string
  full_name?: string | null
  email?: string | null
}

type LabRow = { id: number }

type WorkOrderWithAssigned = WorkOrderRowServer & {
  assigned: ProfileRow[]
}

export async function POST(req: NextRequest) {
  try {
    // Require Bearer access token
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized: missing or invalid Authorization header" }, { status: 401 })
    }
    const accessToken = authHeader.slice("Bearer ".length).trim()
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized: empty access token" }, { status: 401 })
    }

    // Validate user via Supabase using the access token
    const {
      data: authData,
      error: authError
    } = await serviceClient.auth.getUser(accessToken)
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized: invalid access token" }, { status: 401 })
    }
    const user = authData.user

    // Determine which labs this manager is authorized to access
    const { data: labsData, error: labsError } = await serviceClient
      .from("labs")
      .select("id")
      .eq("manager_id", user.id)

    if (labsError) {
      // eslint-disable-next-line no-console
      console.error("labs lookup error:", labsError.message)
      return NextResponse.json({ error: "Failed to load labs for manager" }, { status: 500 })
    }

    const managedLabIds: number[] = Array.isArray(labsData)
      ? labsData
          .map((row) => {
            if (row && typeof row === "object" && "id" in row) {
              const idVal = (row as Record<string, unknown>).id
              return typeof idVal === "number" ? idVal : NaN
            }
            return NaN
          })
          .filter((id): id is number => Number.isFinite(id))
      : []

    if (managedLabIds.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // parse + strictly validate request body labIds (optional)
    const body = await req.json().catch(() => ({}))
    const rawLabIds = body?.labIds
    if (rawLabIds !== undefined && !Array.isArray(rawLabIds)) {
      return NextResponse.json({ error: "labIds must be an array of numbers" }, { status: 400 })
    }

    // enforce a reasonable upper bound to avoid very large queries
    const MAX_LAB_IDS = 1000
    const requestArray = Array.isArray(rawLabIds) ? rawLabIds : []
    if (requestArray.length > MAX_LAB_IDS) {
      return NextResponse.json({ error: `Too many labIds; maximum allowed is ${MAX_LAB_IDS}` }, { status: 400 })
    }

    // convert to finite numbers, reject if any invalid
    const numericLabIds = requestArray
      .map((value: unknown) =>
        typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
      )
      .map((n) => (Number.isFinite(n) ? n : null))
      .filter((n): n is number => n !== null)

    const requestedLabIds = numericLabIds

    // Only allow labs that the manager actually manages.
    // If no specific labs were requested, use all managed labs.
    const allowedLabIds = (requestedLabIds.length ? requestedLabIds : managedLabIds).filter((id) =>
      managedLabIds.includes(id)
    )

    if (allowedLabIds.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // fetch work orders for allowed labs
    const { data: workOrders, error: woError } = await serviceClient
      .from("work_orders")
      .select("id, title, description, equipment, address_id, category_id, lab, created_at, urgency, status, date, assigned_to")
      .in("lab", allowedLabIds)
      .order("created_at", { ascending: false })

    if (woError) {
      return NextResponse.json({ error: woError.message }, { status: 500 })
    }

    const rows: WorkOrderRowServer[] = (workOrders ?? []) as WorkOrderRowServer[]

    // collect assigned profile ids (string ids)
    const assignedIds: string[] = Array.from(
      new Set(
        rows
          .map((r) => r.assigned_to)
          .filter((v): v is string => typeof v === "string" && v.length > 0)
      )
    )

    const profilesMap: Record<string, ProfileRow> = {}

    if (assignedIds.length > 0) {
      const { data: profilesData, error: profilesErr } = await serviceClient
        .from("profiles")
        .select("id, full_name, email")
        .in("id", assignedIds)

      if (profilesErr) {
        // eslint-disable-next-line no-console
        console.error("profiles lookup error:", profilesErr.message)
      } else if (Array.isArray(profilesData)) {
        for (const raw of profilesData) {
          if (!raw || typeof raw !== "object") continue
          const rowObj = raw as Record<string, unknown>
          const idVal = rowObj.id
          const idStr =
            typeof idVal === "string" ? idVal : typeof idVal === "number" ? String(idVal) : null
          if (!idStr) continue

          const maybeFullName = rowObj.full_name
          const maybeEmail = rowObj.email
          const fullName = typeof maybeFullName === "string" ? maybeFullName : null
          const email = typeof maybeEmail === "string" ? maybeEmail : null

          profilesMap[idStr] = { id: idStr, full_name: fullName, email }
        }
      }
    }

    // attach assigned profile info (array for compatibility with client)
    const withAssigned: WorkOrderWithAssigned[] = rows.map((r) => {
      const assignedInfo = r.assigned_to && profilesMap[r.assigned_to]
        ? [profilesMap[r.assigned_to]]
        : []
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
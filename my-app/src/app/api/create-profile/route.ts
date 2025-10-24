import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

type CreateProfileBody = {
  role: "lab" | "technician" | null
  full_name?: string | null
  phone?: string | null
  lab?: {
    name?: string | null
    address?: string | null
    address2?: string | null
    city?: string | null
    state?: string | null
    zipcode?: string | null
  } | null
  tech?: {
    experience?: string | null
    bio?: string | null
    company?: string | null
  } | null
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 })
    }
    const token = authHeader.split(" ")[1];

    // verify the token
    const {
      data: { user },
      error: userErr,
    } = await serviceClient.auth.getUser(token)
    if (userErr || !user) {
      return NextResponse.json({ error: userErr?.message ?? "Unauthorized" }, { status: 401 })
    }

    // parse/validate request body
  const raw: unknown = await req.json()
  const body = raw as CreateProfileBody // (Optional) replace with Zod validation later

  const userId = user.id

    // First get existing profile to preserve any fields not being updated
    const { data: existingProfile } = await serviceClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()

    // upsert into profiles, preserving existing values if not provided in request
    const profileRow = {
      id: userId,
      role: body.role,
      full_name: body.full_name ?? existingProfile?.full_name ?? null,
      phone: body.phone ?? existingProfile?.phone ?? null,
      email: user.email ?? existingProfile?.email ?? null,
    }

    const { error: pErr } = await serviceClient.from("profiles").upsert(profileRow)
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

    if (body.role === "lab") {
      // First get any existing lab for this manager
      const { data: existingLab } = await serviceClient
        .from("labs")
        .select("id")
        .eq("manager_id", userId)
        .single()

      const lab = {
        manager_id: userId,
        name: body.lab?.name ?? null,
        address: body.lab?.address ?? null,
        address2: body.lab?.address2 ?? null,
        city: body.lab?.city ?? null,
        state: body.lab?.state ?? null,
        zipcode: body.lab?.zipcode ?? null,
      }

      // If lab exists, update it. If not, create it.
      const { error: lErr } = await serviceClient
        .from("labs")
        .upsert(
          existingLab 
            ? { ...lab, id: existingLab.id }
            : lab,
          { onConflict: 'manager_id' }
        )
      if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })
    }

    if (body.role === "technician") {
      const tech = {
        id: userId,
        experience: body.tech?.experience ?? null,
        bio: body.tech?.bio ?? null,
        company: body.tech?.company ?? null
      }

      // First check if technician already exists
      const { data: existingTech } = await serviceClient
        .from("technicians")
        .select("id")
        .eq("id", userId)
        .single()

      // Use upsert to handle both insert and update cases
      const { error: tErr } = await serviceClient
        .from("technicians")
        .upsert(
          existingTech
            ? { ...tech, id: existingTech.id }
            : tech,
          { onConflict: 'id' }
        )
      if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
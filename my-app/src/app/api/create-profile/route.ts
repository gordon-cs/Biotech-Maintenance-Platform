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
  } | null
  address?: {
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
      }

      let labId: number

      // If lab exists, update it. If not, create it.
      if (existingLab) {
        const { error: lErr } = await serviceClient
          .from("labs")
          .update(lab)
          .eq("id", existingLab.id)
        if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })
        labId = existingLab.id
      } else {
        const { data: newLab, error: lErr } = await serviceClient
          .from("labs")
          .insert(lab)
          .select("id")
          .single()
        if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })
        labId = newLab.id
      }

      // Handle address separately if provided
      if (body.address) {
        // Check if address already exists for this lab
        const { data: existingAddress } = await serviceClient
          .from("addresses")
          .select("id")
          .eq("lab_id", labId)
          .maybeSingle()

        const addressData = {
          lab_id: labId,
          address: body.address?.address ?? null,
          address2: body.address?.address2 ?? null,
          city: body.address?.city ?? null,
          state: body.address?.state ?? null,
          zipcode: body.address?.zipcode ?? null,
        }

        if (existingAddress) {
          // Update existing address
          const { error: addrErr } = await serviceClient
            .from("addresses")
            .update(addressData)
            .eq("id", existingAddress.id)
          if (addrErr) return NextResponse.json({ error: addrErr.message }, { status: 500 })
        } else {
          // Create new address
          const { error: addrErr } = await serviceClient
            .from("addresses")
            .insert(addressData)
          if (addrErr) return NextResponse.json({ error: addrErr.message }, { status: 500 })
        }
      }
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
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
    city?: string | null
    state?: string | null
    zipcode?: string | null
  } | null
  tech?: {
    experience?: string | null
    bio?: string | null
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

    // upsert into profiles
    const profileRow = {
      id: userId,
      role: body.role,
      full_name: body.full_name ?? null,
      phone: body.phone ?? null,
      email: user.email ?? null,
    }

    const { error: pErr } = await serviceClient.from("profiles").upsert(profileRow)
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

    if (body.role === "lab") {
      const lab = {
        manager_id: userId,
        name: body.lab?.name ?? null,
        address: body.lab?.address ?? null,
        city: body.lab?.city ?? null,
        state: body.lab?.state ?? null,
        zipcode: body.lab?.zipcode ?? null,
      }
      const { error: lErr } = await serviceClient.from("labs").insert(lab)
      if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })
    }

    if (body.role === "technician") {
      const tech = {
        id: userId,
        experience: body.tech?.experience ?? null,
        bio: body.tech?.bio ?? null,
      }
      const { error: tErr } = await serviceClient.from("technicians").insert(tech)
      if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
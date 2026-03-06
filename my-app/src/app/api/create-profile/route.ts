import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendTechnicianVerificationEmail } from "@/lib/email"

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
    line1?: string | null
    line2?: string | null
    city?: string | null
    state?: string | null
    zipcode?: string | null
  } | null
  tech?: {
    experience?: string | null
    bio?: string | null
    company?: string | null
    resume_url?: string | null
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
        // Check if a default address already exists for this lab
        const { data: existingDefaultAddress } = await serviceClient
          .from("addresses")
          .select("id")
          .eq("lab_id", labId)
          .eq("is_default", true)
          .maybeSingle()

        const addressData = {
          lab_id: labId,
          line1: body.address?.line1 ?? null,
          line2: body.address?.line2 ?? null,
          city: body.address?.city ?? null,
          state: body.address?.state ?? null,
          zipcode: body.address?.zipcode ?? null,
          is_default: true, // Always set/keep as default
        }

        if (existingDefaultAddress) {
          // Update existing default address
          const { error: addrErr } = await serviceClient
            .from("addresses")
            .update(addressData)
            .eq("id", existingDefaultAddress.id)
          if (addrErr) return NextResponse.json({ error: addrErr.message }, { status: 500 })
        } else {
          // Create new default address (first address for this lab)
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
        company: body.tech?.company ?? null,
        resume_url: body.tech?.resume_url ?? null
      }

      // First check if technician already exists
      const { data: existingTech, error: techCheckError } = await serviceClient
        .from("technicians")
        .select("id, experience, bio")
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

      // Send verification email if this is a new technician OR if they're completing their profile for the first time
      // (i.e., they didn't have experience/bio before but do now)
      const isFirstTimeCompletion = !existingTech || (!existingTech.experience && !existingTech.bio)
      const hasNewTechData = body.tech?.experience || body.tech?.bio
      
      if (isFirstTimeCompletion && hasNewTechData) {
        try {
          await sendTechnicianVerificationEmail({
            technicianName: body.full_name || 'Unknown',
            technicianEmail: user.email || 'No email provided',
            technicianId: userId,
            experience: body.tech?.experience || 'Not provided',
            bio: body.tech?.bio || 'Not provided',
            company: body.tech?.company || undefined,
          })
          console.log('Verification email sent to admin for technician:', userId)
        } catch (emailError) {
          console.error('Failed to send verification email:', emailError)
          // Don't fail the request if email fails
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

/**
 * GET /api/technicians/resume?tech_id=abc123
 * Generates a signed URL for a technician's resume
 * Only for admin users
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 })
    }
    const token = authHeader.split(" ")[1]

    // Verify the token
    const {
      data: { user },
      error: userErr,
    } = await serviceClient.auth.getUser(token)
    if (userErr || !user) {
      return NextResponse.json({ error: userErr?.message ?? "Unauthorized" }, { status: 401 })
    }

    // Verify user is an admin
    const { data: profile, error: profileErr } = await serviceClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profileErr || !profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      )
    }

    if (profile.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can view resumes" },
        { status: 403 }
      )
    }

    const searchParams = req.nextUrl.searchParams
    const techId = searchParams.get("tech_id")

    if (!techId) {
      return NextResponse.json(
        { error: "tech_id parameter is required" },
        { status: 400 }
      )
    }

    // Fetch the technician and verify resume exists
    const { data: technician, error: techErr } = await serviceClient
      .from("technicians")
      .select("id, resume_url")
      .eq("id", techId)
      .single()

    if (techErr || !technician) {
      return NextResponse.json(
        { error: "Technician not found" },
        { status: 404 }
      )
    }

    if (!technician.resume_url) {
      return NextResponse.json(
        { error: "This technician has no resume" },
        { status: 404 }
      )
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
      .from("resume")
      .createSignedUrl(technician.resume_url, 3600)

    if (signedUrlError || !signedUrlData) {
      console.error("Error creating signed URL:", signedUrlError)
      return NextResponse.json(
        { error: "Failed to generate signed URL" },
        { status: 500 }
      )
    }

    return NextResponse.json({ signedUrl: signedUrlData.signedUrl })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("Unexpected error in GET /api/technicians/resume:", message)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

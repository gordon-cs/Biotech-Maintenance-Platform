import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

/**
 * GET /api/work-order-updates/attachment?update_id=123
 * Generates a signed URL for a work order update attachment
 * Only after verifying the user has access to the work order
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

    const searchParams = req.nextUrl.searchParams
    const updateId = searchParams.get("update_id")

    if (!updateId) {
      return NextResponse.json(
        { error: "update_id parameter is required" },
        { status: 400 }
      )
    }

    // Fetch the update and verify attachment exists
    const { data: update, error: updateErr } = await serviceClient
      .from("work_order_updates")
      .select("id, work_order_id, attachment_url")
      .eq("id", updateId)
      .single()

    if (updateErr || !update) {
      return NextResponse.json(
        { error: "Update not found" },
        { status: 404 }
      )
    }

    if (!update.attachment_url) {
      return NextResponse.json(
        { error: "This update has no attachment" },
        { status: 404 }
      )
    }

    // Fetch the work order to verify access
    const { data: workOrder, error: woErr } = await serviceClient
      .from("work_orders")
      .select("id, lab, assigned_to")
      .eq("id", update.work_order_id)
      .single()

    if (woErr || !workOrder) {
      return NextResponse.json(
        { error: "Work order not found" },
        { status: 404 }
      )
    }

    // Get user's role
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

    // Verify user has access to this work order
    let hasAccess = false
    
    if (profile.role === "admin") {
      // Admins can view all attachments
      hasAccess = true
    } else if (profile.role === "technician") {
      // Technicians can view if assigned to the work order
      hasAccess = workOrder.assigned_to === user.id
    } else if (profile.role === "lab") {
      // Lab managers can view if it's their lab's work order
      const { data: lab } = await serviceClient
        .from("labs")
        .select("id")
        .eq("manager_id", user.id)
        .eq("id", workOrder.lab)
        .single()
      
      hasAccess = !!lab
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: "You don't have permission to view this attachment" },
        { status: 403 }
      )
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
      .from("updates")
      .createSignedUrl(update.attachment_url, 3600)

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
    console.error("Unexpected error in GET /api/work-order-updates/attachment:", message)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

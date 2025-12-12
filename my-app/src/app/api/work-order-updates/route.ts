import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendWorkOrderUpdateEmail } from "@/lib/email"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

/**
 * GET /api/work-order-updates?work_order_id=123
 * Fetches all updates for a specific work order
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const workOrderId = searchParams.get("work_order_id")

    if (!workOrderId) {
      return NextResponse.json(
        { error: "work_order_id parameter is required" },
        { status: 400 }
      )
    }

    // Fetch updates with author profile information
    const { data, error } = await serviceClient
      .from("work_order_updates")
      .select(`
        id,
        work_order_id,
        author_id,
        update_type,
        new_status,
        body,
        created_at,
        author:profiles!author_id (
          id,
          full_name,
          email,
          role
        )
      `)
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching work order updates:", error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("Unexpected error in GET /api/work-order-updates:", message)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/work-order-updates
 * Creates a new update (comment or status change) for a work order
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 })
    }
    const token = authHeader.split(" ")[1]

    // verify the token
    const {
      data: { user },
      error: userErr,
    } = await serviceClient.auth.getUser(token)
    if (userErr || !user) {
      return NextResponse.json({ error: userErr?.message ?? "Unauthorized" }, { status: 401 })
    }

    const raw: unknown = await req.json()
    const body = raw as {
      work_order_id: number
      update_type: "comment" | "status_change"
      new_status?: string | null
      body: string
    }

    // Validation
    if (!body.work_order_id || !body.update_type || !body.body?.trim()) {
      return NextResponse.json(
        { error: "Missing required fields: work_order_id, update_type, and body are required" },
        { status: 400 }
      )
    }

    if (body.update_type !== "comment" && body.update_type !== "status_change") {
      return NextResponse.json(
        { error: "update_type must be 'comment' or 'status_change'" },
        { status: 400 }
      )
    }

    if (body.update_type === "status_change" && !body.new_status) {
      return NextResponse.json(
        { error: "new_status is required when update_type is status_change" },
        { status: 400 }
      )
    }

    // For status changes, verify user is a technician
    if (body.update_type === "status_change") {
      const { data: profile, error: profileErr } = await serviceClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (profileErr) {
        console.error("Database error fetching user profile:", profileErr.message)
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        )
      }
      if (profile?.role !== "technician") {
        return NextResponse.json(
          { error: "Only technicians can change work order status" },
          { status: 403 }
        )
      }

      // Only allow changing status to "completed"
      if (body.new_status !== "completed") {
        return NextResponse.json(
          { error: "Status can only be changed to 'completed'" },
          { status: 400 }
        )
      }

      // Verify the technician is assigned to this work order
      const { data: workOrder, error: woErr } = await serviceClient
        .from("work_orders")
        .select("assigned_to, status")
        .eq("id", body.work_order_id)
        .single()

      if (woErr) {
        console.error("Error fetching work order:", woErr)
        return NextResponse.json(
          { error: "Failed to fetch work order" },
          { status: 500 }
        )
      }
      if (!workOrder) {
        return NextResponse.json(
          { error: "Work order not found" },
          { status: 404 }
        )
      }

      // Cannot change status if already completed
      if (workOrder.status === "completed") {
        return NextResponse.json(
          { error: "This work order is already completed and cannot be modified" },
          { status: 400 }
        )
      }

      // Technician must be assigned to the work order to complete it
      const isAssigned = workOrder.assigned_to === user.id

      if (!isAssigned) {
        return NextResponse.json(
          { error: "You must be assigned to this work order to mark it as completed" },
          { status: 403 }
        )
      }
    }

    // Insert the update (author_id will be set from user.id automatically by the trigger)
    const { data, error } = await serviceClient
      .from("work_order_updates")
      .insert({
        work_order_id: body.work_order_id,
        author_id: user.id,
        update_type: body.update_type,
        new_status: body.update_type === "status_change" ? body.new_status : null,
        body: body.body.trim(),
      })
      .select(`
        id,
        work_order_id,
        author_id,
        update_type,
        new_status,
        body,
        created_at,
        author:profiles!author_id (
          id,
          full_name,
          email,
          role
        )
      `)
      .single()

    if (error) {
      console.error("Error creating work order update:", error)
      
      // Provide more helpful error messages
      let errorMessage = error.message
      let statusCode = 500
      if (error.message?.includes("permission") || error.message?.includes("policy")) {
        errorMessage = "You don't have permission to update this work order. You may need to be assigned to it first."
        statusCode = 403
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: statusCode }
      )
    }

    // Send email notification after successful update
    try {
      // Fetch work order details for email
      const { data: workOrderDetails } = await serviceClient
        .from("work_orders")
        .select(`
          id,
          title,
          lab,
          assigned_to
        `)
        .eq("id", body.work_order_id)
        .single()

      if (workOrderDetails && data?.author) {
        // Get author info from the returned data
        const author = Array.isArray(data.author) ? data.author[0] : data.author
        const authorRole = author?.role as string
        const authorName = author?.full_name || author?.email || "Unknown User"
        
        console.log("Email notification - Author role:", authorRole)
        console.log("Email notification - Work order assigned_to:", workOrderDetails.assigned_to)
        
        // Determine recipient based on author role
        let recipientEmail: string | null = null
        let recipientName: string | null = null

        if (authorRole === "technician") {
          // Technician posted update -> send to lab manager
          console.log("Technician posted update - fetching lab manager")
          // Get the lab manager's info
          const { data: labData } = await serviceClient
            .from("labs")
            .select("manager_id")
            .eq("id", workOrderDetails.lab)
            .single()
          
          console.log("Lab data:", labData)
          
          if (labData?.manager_id) {
            const { data: managerProfile } = await serviceClient
              .from("profiles")
              .select("email, full_name")
              .eq("id", labData.manager_id)
              .single()
            
            console.log("Manager profile:", managerProfile)
            
            if (managerProfile?.email) {
              recipientEmail = managerProfile.email
              recipientName = managerProfile.full_name || null
            }
          }
        } else if (authorRole === "lab") {
          // Lab manager posted update -> send to assigned technician
          console.log("Lab manager posted update - fetching assigned technician")
          
          if (workOrderDetails.assigned_to) {
            const { data: technicianProfile } = await serviceClient
              .from("profiles")
              .select("email, full_name")
              .eq("id", workOrderDetails.assigned_to)
              .single()
            
            console.log("Technician profile:", technicianProfile)
            
            if (technicianProfile?.email) {
              recipientEmail = technicianProfile.email
              recipientName = technicianProfile.full_name || null
            }
          } else {
            console.log("Work order not assigned to any technician - skipping email")
          }
        }

        console.log("Final recipient email:", recipientEmail)

        // Send email if we have a recipient
        if (recipientEmail) {
          const emailResult = await sendWorkOrderUpdateEmail(
            {
              email: recipientEmail,
              name: recipientName || undefined,
            },
            {
              workOrderId: body.work_order_id,
              workOrderTitle: workOrderDetails.title || `Work Order #${body.work_order_id}`,
              updateType: body.update_type,
              newStatus: body.new_status || undefined,
              updateBody: body.body.trim(),
              authorName,
              authorRole,
            }
          )

          if (!emailResult.success) {
            console.error("Failed to send email notification:", emailResult.error)
            // Don't fail the request if email fails - just log it
          } else {
            console.log("Email sent successfully to:", recipientEmail)
          }
        } else {
          console.log("No recipient email found - skipping email notification")
        }
      }
    } catch (emailError) {
      console.error("Error sending email notification:", emailError)
      // Don't fail the request if email fails - just log it
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("Unexpected error in POST /api/work-order-updates:", message)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { upsertVendorForTechnician } from "@/lib/bill/vendor";

type SyncVendorRequestBody = {
  technicianId?: string;
};

function toHttpStatus(code: "validation_error" | "not_found" | "sync_error"): number {
  if (code === "validation_error") return 400;
  if (code === "not_found") return 404;
  return 500;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as SyncVendorRequestBody;
    const technicianId = (body.technicianId || "").trim();

    if (!technicianId) {
      return NextResponse.json(
        {
          ok: false,
          code: "validation_error",
          error: "technicianId is required",
        },
        { status: 400 }
      );
    }

    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single<{ id: string; role: "admin" | "lab" | "technician" | null }>()

    if (profileError || !callerProfile) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      )
    }

    const isAdmin = callerProfile.role === "admin"
    const isSelfTechnician = callerProfile.role === "technician" && user.id === technicianId

    if (!isAdmin && !isSelfTechnician) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      )
    }

    const result = await upsertVendorForTechnician(technicianId);

    if (!result.ok) {
      return NextResponse.json(result, { status: toHttpStatus(result.code) });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json(
      {
        ok: false,
        code: "sync_error",
        error: message,
      },
      { status: 500 }
    );
  }
}

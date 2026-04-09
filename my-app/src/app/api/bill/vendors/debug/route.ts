import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { debugVendorSync } from "@/lib/bill/vendor";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "").trim();

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single<{ role: string | null }>();

    if (callerProfile?.role !== "admin") {
      return NextResponse.json({ ok: false, error: "Forbidden — admin only" }, { status: 403 });
    }

    const body = (await request.json()) as { technicianId?: string };
    const technicianId = (body.technicianId || "").trim();
    if (!technicianId) {
      return NextResponse.json({ ok: false, error: "technicianId is required" }, { status: 400 });
    }

    const result = await debugVendorSync(technicianId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { upsertVendorForTechnician } from "@/lib/bill/vendor";

const BATCH_SIZE = 5;

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

    // Find all technicians not yet synced
    const { data: technicians, error: queryError } = await supabaseAdmin
      .from("technicians")
      .select("id")
      .or("bill_vendor_id.is.null,vendor_status.is.null,vendor_status.neq.synced");

    if (queryError) {
      return NextResponse.json({ ok: false, error: queryError.message }, { status: 500 });
    }

    const ids = (technicians ?? []).map((t: { id: string }) => t.id);
    const total = ids.length;
    let synced = 0;
    const failedIds: string[] = [];

    // Process in small batches to avoid hammering Bill.com
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const settled = await Promise.allSettled(batch.map((id: string) => upsertVendorForTechnician(id)));

      settled.forEach((item, index) => {
        const id = batch[index];
        if (item.status === "fulfilled" && item.value.ok) {
          synced += 1;
          return;
        }
        failedIds.push(id);
      });
    }

    const failed = failedIds.length;

    return NextResponse.json({
      ok: true,
      summary: { total, synced, failed, failedIds },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

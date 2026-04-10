import { createClient } from "@supabase/supabase-js";
import { billClient, type BillVendorPayload } from "@/lib/bill/client";
import type { VendorDebugResult, VendorDebugRecommendedAction } from "@/lib/bill/types";
import { sendVendorConnectionInviteEmail } from "@/lib/email";

// ─── Logging helpers ──────────────────────────────────────────────────────────

const LOG_PREFIX = "[VendorSync]";
function log(msg: string, ...args: unknown[]): void {
  console.log(`${LOG_PREFIX} ${msg}`, ...args);
}
function logError(msg: string, ...args: unknown[]): void {
  console.error(`${LOG_PREFIX} ${msg}`, ...args);
}

// ─── DB row types ─────────────────────────────────────────────────────────────

type TechnicianRow = {
  id: string;
  bill_vendor_id: string | null;
  vendor_status: string | null;
  vendor_last_synced_at: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  company: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type TechnicianBaseRow = {
  id: string;
  bill_vendor_id: string | null;
  vendor_status: string | null;
  vendor_last_synced_at: string | null;
  company: string | null;
};

// ─── Public result types ──────────────────────────────────────────────────────

type MissingField = "full_name" | "email" | "line1" | "city" | "state" | "zipcode";

export type VendorPayloadBuildResult =
  | { ok: true; payload: BillVendorPayload }
  | { ok: false; code: "validation_error"; message: string; missingFields: MissingField[] };

export type UpsertVendorSuccessResult = {
  ok: true;
  code: "synced";
  action: "created" | "updated";
  technicianId: string;
  billVendorId: string;
  vendorStatus: "synced";
  vendorLastSyncedAt: string;
};

export type UpsertVendorErrorResult = {
  ok: false;
  code: "validation_error" | "not_found" | "sync_error";
  message: string;
  technicianId: string;
  missingFields?: MissingField[];
};

export type UpsertVendorForTechnicianResult = UpsertVendorSuccessResult | UpsertVendorErrorResult;

// ─── AP bill stub types ───────────────────────────────────────────────────────

export type CreateTechnicianBillInput = {
  technicianId: string;
  workOrderId: string;
  amount: number;
  description?: string;
  dueDate?: string; // ISO date YYYY-MM-DD; defaults to 30 days out
};

export type CreateTechnicianBillResult =
  | { ok: true; billId: string; technicianId: string }
  | { ok: false; technicianId: string; message: string };

// ─── Supabase admin client ────────────────────────────────────────────────────

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Internal helpers ─────────────────────────────────────────────────────────

function safeString(value: string | null | undefined): string {
  return (value || "").trim();
}

function isMissingColumnError(message?: string): boolean {
  const text = (message || "").toLowerCase();
  return (
    text.includes("column technicians.line1 does not exist") ||
    text.includes("could not find the 'line1' column") ||
    text.includes("column technicians.city does not exist") ||
    text.includes("could not find the 'city' column") ||
    text.includes("column technicians.state does not exist") ||
    text.includes("could not find the 'state' column") ||
    text.includes("column technicians.zipcode does not exist") ||
    text.includes("could not find the 'zipcode' column")
  );
}

function shouldFallbackToCreateFromUpdateError(message?: string): boolean {
  const text = (message || "").toLowerCase();
  return (
    text.includes("bdc_1119") ||
    text.includes("invalid field,value: id") ||
    text.includes("vendor not found") ||
    text.includes("resource not found")
  );
}

async function fetchTechnicianForVendorSync(technicianId: string): Promise<{
  technician: TechnicianRow | null;
  errorMessage?: string;
}> {
  const withAddress = await supabaseAdmin
    .from("technicians")
    .select("id, bill_vendor_id, vendor_status, vendor_last_synced_at, company, line1, line2, city, state, zipcode")
    .eq("id", technicianId)
    .single<TechnicianRow>();

  if (!withAddress.error) {
    return { technician: withAddress.data };
  }

  if (!isMissingColumnError(withAddress.error.message)) {
    return { technician: null, errorMessage: withAddress.error.message };
  }

  // Legacy schema fallback: row exists but address columns are absent.
  const baseOnly = await supabaseAdmin
    .from("technicians")
    .select("id, bill_vendor_id, vendor_status, vendor_last_synced_at, company")
    .eq("id", technicianId)
    .single<TechnicianBaseRow>();

  if (baseOnly.error || !baseOnly.data) {
    return { technician: null, errorMessage: baseOnly.error?.message || withAddress.error.message };
  }

  return {
    technician: {
      ...baseOnly.data,
      line1: null,
      line2: null,
      city: null,
      state: null,
      zipcode: null,
    },
    errorMessage: withAddress.error.message,
  };
}

/**
 * Persist vendor_status and optionally vendor_sync_error to the DB.
 * If vendor_sync_error column doesn't exist yet (no migration), retries
 * with status-only to avoid breaking the sync flow.
 */
async function persistSyncStatus(
  technicianId: string,
  status: "synced" | "error" | "pending",
  extra?: Record<string, unknown>
): Promise<void> {
  const payload: Record<string, unknown> = { vendor_status: status, ...extra };
  const { error } = await supabaseAdmin
    .from("technicians")
    .update(payload)
    .eq("id", technicianId);

  if (error) {
    const isUnknownColumn = error.message?.toLowerCase().includes("could not find");
    if (isUnknownColumn && extra) {
      // Column (e.g. vendor_sync_error) not yet in DB — retry with base fields only
      await supabaseAdmin
        .from("technicians")
        .update({ vendor_status: status })
        .eq("id", technicianId);
    } else {
      logError(`Failed to persist vendor_status="${status}" for ${technicianId}:`, error.message);
    }
  }
}

// ─── buildVendorPayload ───────────────────────────────────────────────────────

export function buildVendorPayload(
  profile: Pick<ProfileRow, "full_name" | "email" | "phone">,
  technician: Pick<TechnicianRow, "line1" | "line2" | "city" | "state" | "zipcode" | "company">
): VendorPayloadBuildResult {
  const fullName = safeString(profile.full_name);
  const email = safeString(profile.email);
  const phone = safeString(profile.phone);
  const line1 = safeString(technician.line1);
  const line2 = safeString(technician.line2);
  const city = safeString(technician.city);
  const state = safeString(technician.state);
  const zip = safeString(technician.zipcode);
  const company = safeString(technician.company);
  const vendorName = fullName || company;

  const missingFields: MissingField[] = [];
  if (!vendorName) missingFields.push("full_name");
  if (!email) missingFields.push("email");
  if (!line1) missingFields.push("line1");
  if (!city) missingFields.push("city");
  if (!state) missingFields.push("state");
  if (!zip) missingFields.push("zipcode");

  if (missingFields.length > 0) {
    return {
      ok: false,
      code: "validation_error",
      message: `Missing required vendor fields: ${missingFields.join(", ")}`,
      missingFields,
    };
  }

  return {
    ok: true,
    payload: {
      name: vendorName,
      email,
      phone: phone || undefined,
      companyName: company || undefined,
      address1: line1,
      address2: line2 || undefined,
      city,
      state,
      zip,
      isActive: true,
    },
  };
}

// ─── upsertVendorForTechnician ────────────────────────────────────────────────

export async function upsertVendorForTechnician(
  technicianId: string
): Promise<UpsertVendorForTechnicianResult> {
  log(`Starting sync for technician ${technicianId}`);

  // 1. Fetch technician + profile concurrently to reduce round-trip latency.
  const [technicianFetch, profileFetch] = await Promise.all([
    fetchTechnicianForVendorSync(technicianId),
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, phone")
      .eq("id", technicianId)
      .single<ProfileRow>(),
  ]);

  const technician = technicianFetch.technician;

  if (!technician) {
    logError(`Technician not found: ${technicianId}`, technicianFetch.errorMessage);
    return { ok: false, code: "not_found", technicianId, message: "Technician not found" };
  }
  if (technicianFetch.errorMessage && isMissingColumnError(technicianFetch.errorMessage)) {
    log(`Technician address columns missing in DB schema. Falling back to validation-only address errors.`);
  }
  log(`Technician found. bill_vendor_id=${technician.bill_vendor_id ?? "none"}, status=${technician.vendor_status}`);

  // 2. Validate profile row
  const { data: profile, error: profileError } = profileFetch;

  if (profileError || !profile) {
    logError(`Profile not found for technician: ${technicianId}`, profileError?.message);
    return { ok: false, code: "not_found", technicianId, message: "Profile not found for technician" };
  }
  log(`Profile found. name=${profile.full_name ?? "N/A"}, email=${profile.email ?? "N/A"}`);

  // 3. Build and validate payload
  const payloadResult = buildVendorPayload(profile, technician);
  if (!payloadResult.ok) {
    log(`Validation failed. Missing: ${payloadResult.missingFields.join(", ")}`);
    await persistSyncStatus(technicianId, "error", { vendor_sync_error: payloadResult.message });
    return {
      ok: false,
      code: "validation_error",
      technicianId,
      message: payloadResult.message,
      missingFields: payloadResult.missingFields,
    };
  }

  // 4. Call Bill.com create or update
  const hasVendorId = Boolean(safeString(technician.bill_vendor_id));
  log(`Calling Bill.com ${hasVendorId ? "updateVendor" : "createVendor"}...`);

  try {
    let action: "created" | "updated" = hasVendorId ? "updated" : "created";
    let billResult;

    if (hasVendorId) {
      try {
        billResult = await billClient.updateVendor(technician.bill_vendor_id!, payloadResult.payload);
      } catch (updateErr) {
        const updateMessage = updateErr instanceof Error ? updateErr.message : String(updateErr);
        if (!shouldFallbackToCreateFromUpdateError(updateMessage)) {
          throw updateErr;
        }

        log(`updateVendor failed with invalid vendor id. Falling back to createVendor for ${technicianId}`);
        billResult = await billClient.createVendor(payloadResult.payload);
        action = "created";
      }
    } else {
      billResult = await billClient.createVendor(payloadResult.payload);
      action = "created";
    }

    log(`Bill.com ${action} succeeded. vendorId=${billResult.id}`);

    // 5. Persist success — clear any previous vendor_sync_error
    const syncedAt = new Date().toISOString();
    const successPayload: Record<string, unknown> = {
      bill_vendor_id: billResult.id,
      vendor_status: "synced",
      vendor_last_synced_at: syncedAt,
      vendor_sync_error: null,
    };

    const { error: updateError } = await supabaseAdmin
      .from("technicians")
      .update(successPayload)
      .eq("id", technicianId);

    if (updateError) {
      const isColumnError = updateError.message?.toLowerCase().includes("could not find");
      if (isColumnError) {
        // vendor_sync_error column doesn't exist yet — retry without it
        await supabaseAdmin
          .from("technicians")
          .update({ bill_vendor_id: billResult.id, vendor_status: "synced", vendor_last_synced_at: syncedAt })
          .eq("id", technicianId);
      } else {
        return {
          ok: false,
          code: "sync_error",
          technicianId,
          message: `Vendor synced in Bill.com but failed to update local row: ${updateError.message}`,
        };
      }
    }

    // 6. If vendor network is not connected, attempt Bill.com invite + reminder email.
    try {
      const network = await billClient.getVendorNetworkStatus(billResult.id);
      log(`Vendor ${billResult.id} network status: ${network.status}${network.rawStatus ? ` (${network.rawStatus})` : ""}`);

      if (network.status === "not_connected") {
        try {
          await billClient.sendVendorConnectionInvite(billResult.id, profile.email || undefined);
          log(`Sent Bill.com connection invite for vendor ${billResult.id}`);
        } catch (inviteErr) {
          const message = inviteErr instanceof Error ? inviteErr.message : String(inviteErr);
          logError(`Bill.com invite endpoint failed for vendor ${billResult.id}:`, message);
        }

        if (profile.email) {
          const reminder = await sendVendorConnectionInviteEmail({
            recipientEmail: profile.email,
            recipientName: profile.full_name,
            vendorName: payloadResult.payload.name,
            vendorId: billResult.id,
          });

          if (reminder.success) {
            log(`Sent vendor connection reminder email to ${profile.email}`);
          } else {
            logError(`Failed to send vendor reminder email to ${profile.email}`);
          }
        } else {
          logError(`Cannot send vendor connection reminder email: profile email missing for ${technicianId}`);
        }
      }
    } catch (networkErr) {
      const message = networkErr instanceof Error ? networkErr.message : String(networkErr);
      logError(`Unable to check vendor network status for ${billResult.id}:`, message);
    }

    return {
      ok: true,
      code: "synced",
      action,
      technicianId,
      billVendorId: billResult.id,
      vendorStatus: "synced",
      vendorLastSyncedAt: syncedAt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown vendor sync error";
    logError(`Bill.com ${hasVendorId ? "update" : "create"} failed for ${technicianId}:`, message);
    await persistSyncStatus(technicianId, "error", { vendor_sync_error: message });
    return { ok: false, code: "sync_error", technicianId, message };
  }
}

// ─── debugVendorSync ──────────────────────────────────────────────────────────

/**
 * Returns a structured debug snapshot for a technician without triggering
 * any Bill.com API calls. Useful for diagnosing sync readiness.
 */
export async function debugVendorSync(technicianId: string): Promise<VendorDebugResult> {
  const [technicianFetch, profileFetch] = await Promise.all([
    fetchTechnicianForVendorSync(technicianId),
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, phone")
      .eq("id", technicianId)
      .single<ProfileRow>(),
  ]);

  const technician = technicianFetch.technician;
  const profile = profileFetch.data;

  const technicianFound = Boolean(technician);
  const profileFound = Boolean(profile);
  const hasBillVendorId = Boolean(technician?.bill_vendor_id);
  const currentVendorStatus = technician?.vendor_status ?? null;

  const missingFields: string[] = [];
  if (!technicianFound) {
    missingFields.push("technician_record");
  } else if (!profileFound) {
    missingFields.push("profile_record");
  } else {
    const payloadResult = buildVendorPayload(profile!, technician!);
    if (!payloadResult.ok) missingFields.push(...payloadResult.missingFields);
  }

  let recommendedAction: VendorDebugRecommendedAction;
  if (!technicianFound || !profileFound) {
    recommendedAction = "investigate";
  } else if (missingFields.length > 0) {
    recommendedAction = "fix_data";
  } else if (hasBillVendorId) {
    recommendedAction = "update";
  } else {
    recommendedAction = "create";
  }

  return {
    ok: missingFields.length === 0 && technicianFound && profileFound,
    technicianFound,
    profileFound,
    hasBillVendorId,
    currentVendorStatus,
    missingFields,
    recommendedAction,
  };
}

// ─── createTechnicianVendorBill (stub) ────────────────────────────────────────

/**
 * Stub for future AP bill / technician payout automation.
 * Validates that the technician has a Bill.com vendor ID, then
 * will call billClient.createVendorBill() once fully implemented.
 */
export async function createTechnicianVendorBill(
  input: CreateTechnicianBillInput
): Promise<CreateTechnicianBillResult> {
  log(`[STUB] createTechnicianVendorBill — technician=${input.technicianId}, workOrder=${input.workOrderId}, amount=${input.amount}`);

  const { data: technician } = await supabaseAdmin
    .from("technicians")
    .select("id, bill_vendor_id, vendor_status")
    .eq("id", input.technicianId)
    .single<Pick<TechnicianRow, "id" | "bill_vendor_id" | "vendor_status">>();

  if (!technician?.bill_vendor_id) {
    return {
      ok: false,
      technicianId: input.technicianId,
      message: "Technician has no bill_vendor_id. Run upsertVendorForTechnician first.",
    };
  }

  // TODO: call billClient.createVendorBill({ vendorId, invoiceDate, dueDate, lineItems })
  return {
    ok: false,
    technicianId: input.technicianId,
    message: "AP bill creation not yet implemented.",
  };
}

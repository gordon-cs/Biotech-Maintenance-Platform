// ─── AP Bill types (for future technician payout automation) ─────────────────

export interface BillApBillLineItem {
  amount: number;
  chartOfAccountId?: string;
  description?: string;
}

export interface BillApBillPayload {
  vendorId: string;
  invoiceDate: string; // ISO date string YYYY-MM-DD
  dueDate: string;     // ISO date string YYYY-MM-DD
  invoiceNumber?: string;
  description?: string;
  lineItems: BillApBillLineItem[];
}

export interface BillApBillResult {
  id: string;
  raw: Record<string, unknown>;
}

// ─── Vendor debug types ───────────────────────────────────────────────────────

export type VendorDebugRecommendedAction =
  | "create"       // no bill_vendor_id yet, all required fields present — ready to create
  | "update"       // bill_vendor_id exists, all fields present — ready to update
  | "fix_data"     // missing required fields — data must be completed first
  | "investigate"; // technician or profile row is missing entirely

export type VendorDebugResult = {
  ok: boolean;
  technicianFound: boolean;
  profileFound: boolean;
  hasBillVendorId: boolean;
  currentVendorStatus: string | null;
  missingFields: string[];
  recommendedAction: VendorDebugRecommendedAction;
};

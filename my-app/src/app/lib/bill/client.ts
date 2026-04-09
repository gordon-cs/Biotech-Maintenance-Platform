import type { BillApBillPayload, BillApBillResult } from "@/lib/bill/types";

interface BillLoginResponse {
  message?: string;
  response_data?: {
    sessionId?: string;
  };
  sessionId?: string;
  responseData?: {
    sessionId?: string;
  };
}

interface BillVendorApiResponse {
  id?: string;
  message?: string;
  response_data?: {
    id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface BillVendorPayload {
  name: string;
  email: string;
  phone?: string;
  companyName?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  isActive?: boolean;
}

export interface BillVendorResult {
  id: string;
  raw: BillVendorApiResponse;
}

export type BillVendorNetworkStatus = "connected" | "not_connected" | "unknown";

export interface BillVendorNetworkStatusResult {
  vendorId: string;
  status: BillVendorNetworkStatus;
  rawStatus?: string;
  raw: BillVendorApiResponse;
}

export interface BillVendorInviteResult {
  vendorId: string;
  sent: boolean;
  raw: Record<string, unknown>;
}

type BillVendorRequestPayload = {
  name: string;
  email: string;
  phone?: string;
  companyName?: string;
  isActive?: boolean;
  // Keep flat fields for compatibility with existing Bill.com parsing behavior.
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  // v3 vendors endpoint expects nested address object in many org configs.
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zipcode?: string;
    zipOrPostalCode: string;
    country?: string;
  };
};

export class BillClient {
  private apiUrl: string;
  private devKey: string;
  private sessionId: string | null = null;

  constructor() {
    this.apiUrl = process.env.BILL_BASE_URL || "https://gateway.stage.bill.com/connect/v3";
    this.devKey = (process.env.BILL_DEVELOPER_KEY || "").trim();
  }

  private async login(): Promise<void> {
    if (process.env.BILL_ENV === "mock" || process.env.BILL_ENV === "development") {
      this.sessionId = `mock-session-${Date.now()}`;
      return;
    }

    const baseUrl = process.env.BILL_BASE_URL;
    const username = (process.env.BILL_USERNAME || "").trim();
    const password = (process.env.BILL_PASSWORD || "").trim();
    const organizationId = (process.env.BILL_ORGANIZATION_ID || "").trim();

    const res = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
        devKey: this.devKey,
        organizationId,
      }),
    });

    const responseText = await res.text();
    let parsed: BillLoginResponse | null = null;

    try {
      parsed = responseText ? (JSON.parse(responseText) as BillLoginResponse) : null;
    } catch {
      throw new Error(`Bill.com authentication failed: ${responseText}`);
    }

    if (!res.ok) {
      throw new Error(`Bill.com authentication failed: ${parsed?.message || responseText}`);
    }

    const sessionId =
      parsed?.response_data?.sessionId ?? parsed?.sessionId ?? parsed?.responseData?.sessionId;

    if (!sessionId) {
      throw new Error(`Bill.com authentication failed: ${parsed?.message || responseText}`);
    }

    this.sessionId = sessionId;
  }

  private async ensureLoggedIn(): Promise<void> {
    if (!this.sessionId) {
      await this.login();
    }
  }

  private async parseVendorResponse(response: Response): Promise<BillVendorApiResponse> {
    const text = await response.text();

    try {
      return text ? (JSON.parse(text) as BillVendorApiResponse) : {};
    } catch {
      throw new Error(`Bill.com vendor API returned non-JSON response: ${text}`);
    }
  }

  private normalizeVendorNetworkStatus(value: unknown): BillVendorNetworkStatus {
    const raw = String(value ?? "").trim().toLowerCase();
    if (!raw) return "unknown";
    if (raw.includes("connected") && !raw.includes("not")) return "connected";
    if (
      raw.includes("not_connected") ||
      raw.includes("not connected") ||
      raw.includes("pending") ||
      raw.includes("invited") ||
      raw.includes("disconnected")
    ) {
      return "not_connected";
    }
    return "unknown";
  }

  private extractVendorNetworkStatus(raw: BillVendorApiResponse): { status: BillVendorNetworkStatus; rawStatus?: string } {
    const responseData = (raw.response_data ?? {}) as Record<string, unknown>;

    const directCandidate =
      responseData.networkStatus ??
      responseData.network_status ??
      responseData.paymentNetworkStatus ??
      responseData.payment_network_status ??
      responseData.networkConnectionStatus ??
      raw.networkStatus ??
      raw.network_status ??
      raw.paymentNetworkStatus ??
      raw.payment_network_status;

    if (directCandidate != null) {
      const rawStatus = String(directCandidate);
      return { status: this.normalizeVendorNetworkStatus(rawStatus), rawStatus };
    }

    const nestedConnection = responseData.networkConnection as Record<string, unknown> | undefined;
    const nestedStatus = nestedConnection?.status;
    if (nestedStatus != null) {
      const rawStatus = String(nestedStatus);
      return { status: this.normalizeVendorNetworkStatus(rawStatus), rawStatus };
    }

    return { status: "unknown" };
  }

  private mapVendorPayload(payload: BillVendorPayload): BillVendorRequestPayload {
    return {
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      companyName: payload.companyName,
      isActive: payload.isActive ?? true,
      address1: payload.address1,
      address2: payload.address2,
      city: payload.city,
      state: payload.state,
      zip: payload.zip,
      address: {
        line1: payload.address1,
        line2: payload.address2,
        city: payload.city,
        state: payload.state,
        zipcode: payload.zip,
        zipOrPostalCode: payload.zip,
        country: "US",
      },
    };
  }

  async createVendor(payload: BillVendorPayload): Promise<BillVendorResult> {
    await this.ensureLoggedIn();

    if (process.env.BILL_ENV === "mock" || process.env.BILL_ENV === "development") {
      const mockId = `MOCK-VENDOR-${Date.now()}`;
      return { id: mockId, raw: { id: mockId } };
    }

    const mappedPayload = this.mapVendorPayload(payload);

    const response = await fetch(`${this.apiUrl}/vendors`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        devKey: this.devKey,
        sessionId: this.sessionId!,
      },
      body: JSON.stringify(mappedPayload),
    });

    const result = await this.parseVendorResponse(response);

    if (!response.ok) {
      throw new Error(`Bill.com create vendor failed: ${result.message || JSON.stringify(result)}`);
    }

    const id = result.response_data?.id ?? result.id;

    if (!id) {
      throw new Error(`Bill.com create vendor failed: missing vendor id in response ${JSON.stringify(result)}`);
    }

    return { id, raw: result };
  }

  async updateVendor(vendorId: string, payload: BillVendorPayload): Promise<BillVendorResult> {
    await this.ensureLoggedIn();

    if (process.env.BILL_ENV === "mock" || process.env.BILL_ENV === "development") {
      return { id: vendorId, raw: { id: vendorId } };
    }

    const mappedPayload = this.mapVendorPayload(payload);

    const response = await fetch(`${this.apiUrl}/vendors/${vendorId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        devKey: this.devKey,
        sessionId: this.sessionId!,
      },
      body: JSON.stringify(mappedPayload),
    });

    const result = await this.parseVendorResponse(response);

    if (!response.ok) {
      throw new Error(`Bill.com update vendor failed: ${result.message || JSON.stringify(result)}`);
    }

    const id = result.response_data?.id ?? result.id ?? vendorId;
    return { id, raw: result };
  }

  async getVendor(vendorId: string): Promise<BillVendorResult> {
    await this.ensureLoggedIn();

    if (process.env.BILL_ENV === "mock" || process.env.BILL_ENV === "development") {
      return { id: vendorId, raw: { id: vendorId } };
    }

    const response = await fetch(`${this.apiUrl}/vendors/${vendorId}`, {
      method: "GET",
      headers: {
        "content-type": "application/json",
        devKey: this.devKey,
        sessionId: this.sessionId!,
      },
    });

    const result = await this.parseVendorResponse(response);

    if (!response.ok) {
      throw new Error(`Bill.com get vendor failed: ${result.message || JSON.stringify(result)}`);
    }

    const id = result.response_data?.id ?? result.id ?? vendorId;
    return { id: String(id), raw: result };
  }

  async getVendorNetworkStatus(vendorId: string): Promise<BillVendorNetworkStatusResult> {
    const vendor = await this.getVendor(vendorId);
    const extracted = this.extractVendorNetworkStatus(vendor.raw);

    return {
      vendorId: vendor.id,
      status: extracted.status,
      rawStatus: extracted.rawStatus,
      raw: vendor.raw,
    };
  }

  async sendVendorConnectionInvite(vendorId: string, email?: string): Promise<BillVendorInviteResult> {
    await this.ensureLoggedIn();

    if (process.env.BILL_ENV === "mock" || process.env.BILL_ENV === "development") {
      return {
        vendorId,
        sent: true,
        raw: { mocked: true, vendorId, email: email ?? null },
      };
    }

    const pathTemplate = process.env.BILL_VENDOR_INVITE_PATH || "/vendors/{vendorId}/invite";
    const invitePath = pathTemplate.includes("{vendorId}")
      ? pathTemplate.replace("{vendorId}", encodeURIComponent(vendorId))
      : `/vendors/${encodeURIComponent(vendorId)}/invite`;

    const response = await fetch(`${this.apiUrl}${invitePath}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        devKey: this.devKey,
        sessionId: this.sessionId!,
      },
      body: JSON.stringify({ email }),
    });

    const text = await response.text();
    let raw: Record<string, unknown> = {};
    try {
      raw = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      throw new Error(`Bill.com vendor invite returned non-JSON response: ${text}`);
    }

    if (!response.ok) {
      const message = (raw.message as string | undefined) ?? JSON.stringify(raw);
      throw new Error(`Bill.com vendor invite failed: ${message}`);
    }

    return {
      vendorId,
      sent: true,
      raw,
    };
  }

  async createVendorBill(payload: BillApBillPayload): Promise<BillApBillResult> {
    await this.ensureLoggedIn();

    if (process.env.BILL_ENV === "mock" || process.env.BILL_ENV === "development") {
      const mockId = `MOCK-BILL-${Date.now()}`;
      return { id: mockId, raw: { id: mockId } };
    }

    const response = await fetch(`${this.apiUrl}/bills`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        devKey: this.devKey,
        sessionId: this.sessionId!,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let result: Record<string, unknown> = {};
    try {
      result = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      throw new Error(`Bill.com create bill returned non-JSON: ${text}`);
    }

    if (!response.ok) {
      const msg = (result.message as string | undefined) ?? JSON.stringify(result);
      throw new Error(`Bill.com create bill failed: ${msg}`);
    }

    const responseData = result.response_data as Record<string, unknown> | undefined;
    const id = (responseData?.id ?? result.id) as string | undefined;
    if (!id) {
      throw new Error(`Bill.com create bill failed: missing bill id in response ${JSON.stringify(result)}`);
    }

    return { id, raw: result };
  }
}

export const billClient = new BillClient();

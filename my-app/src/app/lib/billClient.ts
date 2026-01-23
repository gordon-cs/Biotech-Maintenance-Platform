import { supabase } from '@/lib/supabaseClient';

interface BillResponse {
  response_data: {
    sessionId?: string;
    id?: string;
    [key: string]: unknown;
  };
}

class BillClient {
  private apiUrl: string
  private devKey: string
  private sessionId: string | null = null

  constructor() {
    this.apiUrl = process.env.BILL_BASE_URL || 'https://gateway.stage.bill.com/connect/v3'
    this.devKey = (process.env.BILL_DEVELOPER_KEY || '').trim()
  }

  private async login() {
    if (process.env.BILL_ENV === 'mock' || process.env.BILL_ENV === 'development') {
      this.sessionId = 'mock-session-' + Date.now();
      return;
    }
    
    const baseUrl = process.env.BILL_BASE_URL;
    const devKey = (process.env.BILL_DEVELOPER_KEY || '').trim();
    const username = (process.env.BILL_USERNAME || '').trim();
    const password = (process.env.BILL_PASSWORD || '').trim();
    const organizationId = (process.env.BILL_ORGANIZATION_ID || '').trim();

    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        username,                  // ✅ Bill.com v3 spec
        password,
        devKey,                    // ✅ Bill.com v3 spec
        organizationId,            // ✅ Bill.com v3 spec
      }),
    });

    const responseText = await res.text();
    let data: unknown;
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch (e) {
      throw new Error(`Bill.com authentication failed: ${responseText}`);
    }

    const billData = data as { message?: string; response_data?: { sessionId?: string }; sessionId?: string; responseData?: { sessionId?: string } };

    if (!res.ok) {
      throw new Error(
        `Bill.com authentication failed: ${
          billData?.message || JSON.stringify(data)
        }`,
      );
    }

    const sessionId =
      billData?.response_data?.sessionId ??
      billData?.sessionId ??
      billData?.responseData?.sessionId;

    if (!sessionId) {
      throw new Error(
        `Bill.com authentication failed: ${billData?.message || JSON.stringify(data)}`,
      );
    }

    this.sessionId = sessionId;
  }

  private async ensureLoggedIn() {
    if (!this.sessionId) {
      await this.login()
    }
  }

  async createCustomer(input: { name: string; email: string }) {
    await this.ensureLoggedIn();

    const payload = {
      name: input.name,
      email: input.email,
      accountType: 'BUSINESS',
    };

    const res = await fetch(`${this.apiUrl}/customers`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'devKey': this.devKey,
        'sessionId': this.sessionId!,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Bill.com create customer error: ${text}`);
    }

    const customerData = data as { message?: string; id?: string };

    if (!res.ok) {
      throw new Error(
        `Bill.com create customer error: ${customerData?.message || text}`,
      );
    }

    const id = customerData?.id;
    if (!id) {
      throw new Error(
        `Bill.com create customer error: missing id in response ${JSON.stringify(
          data,
        )}`,
      );
    }

    return { id };
  }

  async request<T = BillResponse>(method: string, path: string, body?: unknown): Promise<T> {
    if (!this.sessionId) await this.login();
    
    const requestBody = {
      sessionId: this.sessionId,
      ...(body && typeof body === 'object' ? body : {})
    };
    
    const res = await fetch(`${process.env.BILL_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (res.status === 401) {
      await this.login();
      return this.request(method, path, body);
    }

    return res.json() as T;
  }

  // Ensure customer exists for lab
  async ensureCustomerForLab(labId: number): Promise<string> {
    // Check if lab already has Bill customer ID
    const { data: lab } = await supabase
      .from('labs')
      .select('bill_customer_id, name, address, city, state, zipcode')
      .eq('id', labId)
      .single();

    if (lab?.bill_customer_id) {
      return lab.bill_customer_id;
    }

    // Create customer in Bill.com
    const customerData = {
      obj: {
        name: lab?.name || 'Unknown Lab',
        companyName: lab?.name || 'Unknown Lab',
        address1: lab?.address || '',
        city: lab?.city || '',
        state: lab?.state || '',
        zip: lab?.zipcode || '',
        isActive: true
      }
    };

    const result = await this.request<BillResponse>('POST', '/Crud/Create/Customer.json', customerData);
    const billCustomerId = result.response_data.id;

    if (!billCustomerId) {
      throw new Error('Failed to create customer in Bill.com');
    }

    // Save Bill customer ID to our database
    await supabase
      .from('labs')
      .update({ bill_customer_id: billCustomerId })
      .eq('id', labId);

    return billCustomerId;
  }

  // Create invoice for work order
  async createInvoiceForWorkOrder(workOrderId: string): Promise<void> {
    const { data: workOrder } = await supabase
      .from('work_orders')
      .select(`
        *,
        labs!inner(id, name, bill_customer_id)
      `)
      .eq('id', workOrderId)
      .single();

    if (!workOrder) throw new Error('Work order not found');

    // Ensure customer exists
    const customerId = await this.ensureCustomerForLab(workOrder.labs.id);

    // Create invoice in Bill.com
    const invoiceData = {
      obj: {
        customerId: customerId,
        invoiceNumber: `WO-${workOrderId}`,
        description: workOrder.title || 'Work Order Service',
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days
        itemLineItems: [{
          item: 'Maintenance Service',
          description: workOrder.description || 'Maintenance work',
          quantity: 1,
          price: 150.00 // Default amount, make this dynamic
        }]
      }
    };

    const result = await this.request<BillResponse>('POST', '/Crud/Create/Invoice.json', invoiceData);
    const billInvoiceId = result.response_data.id;

    if (!billInvoiceId) {
      throw new Error('Failed to create invoice in Bill.com');
    }

    // Update work order with Bill invoice info
    await supabase
      .from('work_orders')
      .update({
        bill_invoice_id: billInvoiceId,
        bill_invoice_status: 'draft',
        bill_invoice_amount: 150.00,
        bill_invoice_created_at: new Date().toISOString(),
        bill_last_synced_at: new Date().toISOString()
      })
      .eq('id', workOrderId);
  }

  // Pay vendor for work order  
  async payVendorForWorkOrder(workOrderId: string): Promise<void> {
    const { data: workOrder } = await supabase
      .from('work_orders')
      .select(`
        *,
        profiles!assigned_to(id, email, full_name)
      `)
      .eq('id', workOrderId)
      .single();

    if (!workOrder || !workOrder.profiles) {
      throw new Error('Work order or assigned technician not found');
    }

    // Create vendor if doesn't exist
    const vendorData = {
      obj: {
        name: workOrder.profiles.full_name || workOrder.profiles.email,
        email: workOrder.profiles.email,
        isActive: true
      }
    };

    const vendorResult = await this.request<BillResponse>('POST', '/Crud/Create/Vendor.json', vendorData);
    const vendorId = vendorResult.response_data.id;

    if (!vendorId) {
      throw new Error('Failed to create vendor in Bill.com');
    }

    // Create bill for vendor payment
    const billData = {
      obj: {
        vendorId: vendorId,
        invoiceNumber: `PAY-WO-${workOrderId}`,
        description: `Payment for work order: ${workOrder.title}`,
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        billLineItems: [{
          description: workOrder.description || 'Work order completion',
          quantity: 1,
          unitPrice: 150.00
        }]
      }
    };

    await this.request<BillResponse>('POST', '/Crud/Create/Bill.json', billData);
  }

  // Create invoice from existing invoice record
  async createInvoice(data: {
    vendorId: string
    invoiceNumber: string
    invoiceDate: string
    dueDate: string
    description: string
    amount: number
  }) {
    await this.ensureLoggedIn()

    const invoiceData = {
      vendorId: data.vendorId,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate,
      description: data.description,
      amount: data.amount,
      invoiceLineItems: [
        {
          amount: data.amount,
          description: data.description,
          quantity: 1,
          unitPrice: data.amount
        }
      ]
    }

    const response = await fetch(`${this.apiUrl}/Invoice.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        devKey: this.devKey,
        sessionId: this.sessionId,
        data: invoiceData
      })
    })

    const result = await response.json()

    if (result.response_status !== 0) {
      throw new Error(result.response_message || 'Failed to create invoice')
    }

    return result.response_data
  }

  async createInvoiceFromInvoiceRecord(invoiceRecord: { 
    work_order_id: number; 
    lab_id: number; 
    total_amount: number; 
    work_orders?: { id?: number; title?: string };
    labs?: { bill_vendor_id?: string };
    [key: string]: unknown 
  }) {
    if (!invoiceRecord) {
      throw new Error('Invoice record is required')
    }

    const workOrderId = invoiceRecord.work_order_id || invoiceRecord.work_orders?.id
    const workOrderTitle = invoiceRecord.work_orders?.title || `Work Order #${workOrderId}`
    const vendorId = invoiceRecord.labs?.bill_vendor_id
    const totalAmount = invoiceRecord.total_amount

    if (!totalAmount || totalAmount <= 0) {
      throw new Error('Invalid invoice amount')
    }

    if (!vendorId) {
      throw new Error('Lab does not have a Bill.com vendor ID')
    }

    const today = new Date()
    const dueDate = new Date(today)
    dueDate.setDate(dueDate.getDate() + 30)

    return await this.createInvoice({
      vendorId: vendorId,
      invoiceNumber: `WO-${workOrderId}`,
      invoiceDate: today.toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      description: workOrderTitle,
      amount: Number(totalAmount)
    })
  }

  // AR Invoice 생성 (랩 → BBM)
  async createARInvoice(data: {
    customerId: string
    invoiceNumber: string
    invoiceDate: string
    dueDate: string
    description: string
    amount: number
    customerEmail: string
    customerName?: string
    initialFee?: number
  }) {
    await this.ensureLoggedIn()

    if (process.env.BILL_ENV === 'mock' || process.env.BILL_ENV === 'development') {
      const mockInvoice = {
        id: 'MOCK-AR-INV-' + Date.now(),
        invoiceNumber: data.invoiceNumber,
        amount: data.amount,
        customerEmail: data.customerEmail,
        status: 'Sent',
        createdAt: new Date().toISOString()
      };
      return mockInvoice;
    }

    // Build line items - separate initial fee from remaining service cost
    const invoiceLineItems = []
    
    console.log('=== Bill.com Invoice Creation ===')
    console.log('Total Amount:', data.amount)
    console.log('Initial Fee:', data.initialFee)
    
    if (data.initialFee && data.initialFee > 0) {
      // Add initial fee as first line item
      invoiceLineItems.push({
        quantity: 1,
        description: 'Initial Service Fee',
        price: data.initialFee,
      })
      
      // Add remaining amount as second line item
      const remainingAmount = data.amount - data.initialFee
      if (remainingAmount > 0) {
        invoiceLineItems.push({
          quantity: 1,
          description: data.description,
          price: remainingAmount,
        })
      }
      console.log('Line Items (with initial fee):', invoiceLineItems)
    } else {
      // No initial fee - single line item
      invoiceLineItems.push({
        quantity: 1,
        description: data.description,
        price: data.amount,
      })
      console.log('Line Items (no initial fee):', invoiceLineItems)
    }

    const url = `${this.apiUrl}/invoices`

    const payload = {
      // ✅ Bill.com v3 API: customer must be an object with id
      customer: {
        id: data.customerId,                // Must be Bill.com customer ID (0cu...)
      },
      
      invoiceLineItems,
      
      invoiceNumber: data.invoiceNumber,
      dueDate: data.dueDate,                // "YYYY-MM-DD"
      invoiceDate: data.invoiceDate,        // "YYYY-MM-DD"
      
      // Send email to customer with invoice
      sendEmail: true,
      
      // Optional: send email to customer automatically (alternative location)
      processingOptions: {
        sendEmail: true,
      },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'devKey': this.devKey,
        'sessionId': this.sessionId!,
      },
      body: JSON.stringify(payload)
    })

    const responseText = await response.text()
    let result: unknown
    try {
      result = responseText ? JSON.parse(responseText) : null
    } catch (e) {
      throw new Error(`Bill.com AR invoice error: ${responseText}`)
    }

    const arResult = result as { message?: string; response_data?: { id?: string; [key: string]: unknown }; id?: string; invoiceId?: string };

    if (!response.ok) {
      const msg = arResult?.message || JSON.stringify(result)
      throw new Error(`Bill.com AR invoice error: ${msg}`)
    }

    const id = arResult?.response_data?.id ?? arResult?.id ?? arResult?.invoiceId

    if (!id) {
      throw new Error(
        `Bill.com AR invoice: missing id in response: ${JSON.stringify(result)}`
      )
    }

    if (arResult.response_data) {
      return { id, ...arResult.response_data }
    }
    return { id }
  }

  // Vendor Bill 생성 (BBM → 테크니션)
  async createVendorBill(data: {
    vendorId: string
    billNumber: string
    invoiceDate: string
    dueDate: string
    description: string
    amount: number
  }) {
    await this.ensureLoggedIn()

    const billData = {
      vendorId: data.vendorId,
      invoiceNumber: data.billNumber,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate,
      description: data.description,
      billLineItems: [
        {
          amount: data.amount,
          description: data.description,
          quantity: 1,
          unitPrice: data.amount
        }
      ]
    }

    const response = await fetch(`${this.apiUrl}/Bill.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        devKey: this.devKey,
        sessionId: this.sessionId,
        data: billData
      })
    })

    const result = await response.json()

    if (result.response_status !== 0) {
      throw new Error(result.response_message || 'Failed to create Vendor Bill')
    }

    return result.response_data
  }
}

export const billClient = new BillClient()
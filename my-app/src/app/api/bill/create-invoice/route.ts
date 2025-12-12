import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { billClient } from '@/lib/billClient'

export async function POST(request: NextRequest) {
  try {
    const { invoiceId } = await request.json()
    // Validate invoiceId
    if (
      invoiceId === undefined ||
      invoiceId === null ||
      (typeof invoiceId !== 'number' && typeof invoiceId !== 'string') ||
      (typeof invoiceId === 'string' && invoiceId.trim() === '') ||
      (typeof invoiceId === 'number' && !Number.isFinite(invoiceId))
    ) {
      return NextResponse.json({ error: 'Invalid or missing invoiceId' }, { status: 400 })
    }

    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    // 2) 인보이스 가져오기
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select('id, title, description')
      .eq('id', invoice.work_order_id)
      .single()

    if (woError || !workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    const { data: lab, error: labError } = await supabase
      .from('labs')
      .select('id, name, bill_customer_id, manager_id')
      .eq('id', invoice.lab_id)
      .single()

    if (labError || !lab) {
      return NextResponse.json({ error: 'Lab not found' }, { status: 404 })
    }

    const { data: manager, error: managerError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', lab.manager_id)
      .single()

    if (managerError || !manager?.email) {
      return NextResponse.json(
        { error: 'Lab manager email not configured. Please set a manager for this lab.' },
        { status: 400 }
      )
    }

    if (!invoice.total_amount || Number(invoice.total_amount) <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    let billCustomerId: string | null = lab.bill_customer_id

    if (!billCustomerId || !billCustomerId.startsWith('0cu')) {
      const newCustomer = await billClient.createCustomer({
        name: lab.name ?? 'Lab Customer',
        email: manager?.email ?? 'no-reply@example.com',
      })

      billCustomerId = newCustomer.id

      const { error: labUpdateError } = await supabase
        .from('labs')
        .update({ bill_customer_id: billCustomerId })
        .eq('id', lab.id)
    }
    const today = new Date()
    const invoiceDate = today.toISOString().split('T')[0]
    const dueDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    const arInvoice = await billClient.createARInvoice({
      customerId: billCustomerId!,
      invoiceNumber: `WO-${workOrder.id}-AR`,
      invoiceDate,
      dueDate,
      description: `Service: ${workOrder.title || 'Work Order'}`,
      amount: Number(invoice.total_amount),
      customerEmail: manager.email,
      customerName: manager.full_name || lab.name,
    })

    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        bill_ar_invoice_id: arInvoice.id,
        payment_status: 'awaiting_payment',
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)

    if (updateError) {
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    return NextResponse.json(
      {
        success: true,
        arInvoiceId: arInvoice.id,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create AR invoice' },
      { status: 500 }
    )
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  )
}

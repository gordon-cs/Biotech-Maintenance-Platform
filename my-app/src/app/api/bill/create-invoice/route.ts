import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { billClient } from '@/lib/billClient'

// Create admin client for bypassing RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { invoiceId } = await request.json()
    
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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const { data: workOrder, error: woError } = await supabaseAdmin
      .from('work_orders')
      .select('id, title, description, initial_fee')
      .eq('id', invoice.work_order_id)
      .single()

    if (woError || !workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    const { data: lab, error: labError } = await supabaseAdmin
      .from('labs')
      .select('id, name, bill_customer_id, manager_id')
      .eq('id', invoice.lab_id)
      .single()

    if (labError || !lab) {
      return NextResponse.json({ error: 'Lab not found' }, { status: 404 })
    }

    const { data: manager, error: managerError } = await supabaseAdmin
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

      await supabaseAdmin
        .from('labs')
        .update({ bill_customer_id: billCustomerId })
        .eq('id', lab.id)
    }
    const today = new Date()
    const invoiceDate = today.toISOString().split('T')[0]
    const dueDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    const invoiceType = invoice.invoice_type || 'service'
    const isInitialFee = invoiceType === 'initial_fee'
    
    const description = isInitialFee 
      ? `Platform Fee - ${workOrder.title || 'Work Order'}`
      : `Service Fee - ${workOrder.title || 'Work Order'}`
    
    const invoiceNumber = isInitialFee
      ? `WO-${workOrder.id}-INITIAL`
      : `WO-${workOrder.id}-SERVICE`

    const arInvoice = await billClient.createARInvoice({
      customerId: billCustomerId!,
      invoiceNumber: invoiceNumber,
      invoiceDate,
      dueDate,
      description: description,
      amount: Number(invoice.total_amount),
      customerEmail: manager.email,
      customerName: manager.full_name || lab.name,
    })

    const { error: updateError } = await supabaseAdmin
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
    const errorMessage = error instanceof Error ? error.message : 'Failed to create AR invoice'
    return NextResponse.json(
      { error: errorMessage },
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

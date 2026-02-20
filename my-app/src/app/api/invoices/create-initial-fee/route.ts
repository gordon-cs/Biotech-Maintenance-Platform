import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { billClient } from '@/lib/billClient'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { workOrderId } = await request.json()

    if (!workOrderId || typeof workOrderId !== 'number') {
      return NextResponse.json({ error: 'Invalid workOrderId' }, { status: 400 })
    }

    const { data: workOrder, error: woError } = await supabaseAdmin
      .from('work_orders')
      .select('id, title, lab, initial_fee, created_by')
      .eq('id', workOrderId)
      .single()

    if (woError || !workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    const initialFee = workOrder.initial_fee || 50.00

    const { data: lab, error: labError } = await supabaseAdmin
      .from('labs')
      .select('id, name, bill_customer_id, manager_id')
      .eq('id', workOrder.lab)
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
        { error: 'Lab manager email not configured' },
        { status: 400 }
      )
    }

    const { data: creator, error: creatorError } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', workOrder.created_by)
      .single()

    if (creatorError || !creator?.email) {
      return NextResponse.json(
        { error: 'Work order creator email not found' },
        { status: 400 }
      )
    }

    // Create initial fee invoice in database
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .insert({
        work_order_id: workOrderId,
        lab_id: workOrder.lab,
        created_by: workOrder.created_by,
        total_amount: initialFee,
        payment_status: 'unbilled',
        invoice_type: 'initial_fee'
      })
      .select()
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
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

    if (!billCustomerId) {
      return NextResponse.json({ error: 'Failed to create Bill.com customer' }, { status: 500 })
    }

    const today = new Date()
    const invoiceDate = today.toISOString().split('T')[0]
    const dueDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    // Create invoice in Bill.com
    const billInvoice = await billClient.createARInvoice({
      customerId: billCustomerId,
      invoiceNumber: `WO-${workOrderId}-INITIAL`,
      invoiceDate,
      dueDate,
      description: `Initial Fee - ${workOrder.title || 'Work Order'}`,
      amount: Number(initialFee),
      customerEmail: manager.email,
      customerName: manager.full_name || lab.name,
    })

    // Update invoice with Bill.com ID
    await supabaseAdmin
      .from('invoices')
      .update({ bill_ar_invoice_id: billInvoice.id })
      .eq('id', invoice.id)

    // Send initial fee invoice email to lab manager
    try {
      await resend.emails.send({
        from: 'Biotech Maintenance <noreply@biotechmaintenance.com>',
        to: manager.email,
        subject: `🏢 Initial Fee Invoice for Work Order #${workOrderId}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">Initial Fee Invoice</h2>
            <p>Hi ${manager.full_name || 'Lab Manager'},</p>
            <p>A new work order has been submitted and requires payment of the initial service fee.</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Work Order:</strong> #${workOrderId}</p>
              <p><strong>Title:</strong> ${workOrder.title}</p>
              <p><strong>Lab:</strong> ${lab.name}</p>
              <p><strong>Initial Fee:</strong> $${Number(initialFee).toFixed(2)}</p>
              <p><strong>Invoice ID:</strong> #${invoice.id}</p>
            </div>
            <p>The initial fee invoice has been created in Bill.com and is ready for payment.</p>
            <p>Best regards,<br/>Biotech Maintenance Platform</p>
          </div>
        `
      })
    } catch (emailError) {
      console.error('Failed to send initial fee email:', emailError)
    }

    return NextResponse.json({
      invoiceId: invoice.id,
      message: 'Initial fee invoice created and email sent'
    })
  } catch (error) {
    console.error('Error creating initial fee invoice:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

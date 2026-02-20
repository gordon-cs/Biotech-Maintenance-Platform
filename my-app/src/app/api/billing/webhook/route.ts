import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()

    // Bill.com v3 webhook format: metadata contains eventType, invoice contains the data
    const metadata = payload?.metadata || {}
    const invoice_data = payload?.invoice || {}
    
    const eventType = metadata?.eventType
    const billInvoiceId = invoice_data?.id
    const billStatus = invoice_data?.status
    const dueAmount = invoice_data?.dueAmount

    if (!billInvoiceId) {
      return NextResponse.json({ error: 'Missing invoice id' }, { status: 400 })
    }

    // Find invoice by bill_ar_invoice_id
    const { data: dbInvoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('id, payment_status, bill_ar_invoice_id')
      .eq('bill_ar_invoice_id', billInvoiceId)
      .single()

    if (invoiceError || !dbInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Check if payment is confirmed
    // Bill.com status can be: DRAFT, SENT, VIEWED, PARTIALLY_PAID, PAID_IN_FULL, OVERDUE, etc.
    const isPaymentConfirmed =
      billStatus === 'PAID_IN_FULL' ||
      (dueAmount !== undefined && Number(dueAmount) === 0)

    if (isPaymentConfirmed) {
      // Skip if already paid
      if (dbInvoice.payment_status === 'paid') {
        return NextResponse.json({ ok: true, message: 'Invoice already paid' }, { status: 200 })
      }

      // Update invoice status to paid
      const { error: updateError } = await supabaseAdmin
        .from('invoices')
        .update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', dbInvoice.id)

      if (updateError) {
        return NextResponse.json({ error: 'Update failed: ' + updateError.message }, { status: 500 })
      }
      return NextResponse.json({
        ok: true,
        message: 'Invoice marked as paid',
        invoiceId: dbInvoice.id,
        timestamp: new Date().toISOString(),
      })
    }

    // Handle other invoice events
    if (eventType === 'invoice.updated') {
      // Update status to awaiting_payment if it was unbilled and now sent
      if (dbInvoice.payment_status === 'unbilled' && (billStatus === 'SENT' || billStatus === 'VIEWED')) {
        try {
          await supabaseAdmin
            .from('invoices')
            .update({ payment_status: 'awaiting_payment', updated_at: new Date().toISOString() })
            .eq('id', dbInvoice.id)
        } catch (err) {
        }
      }
    }

    if (eventType === 'payment.updated') {
      // Payment updated event handled
    }

    return NextResponse.json({ ok: true, message: 'Webhook processed', eventType })
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Bill.com webhook endpoint is operational',
    timestamp: new Date().toISOString(),
    status: 'active',
  })
}

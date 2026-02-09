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

    console.log('[Webhook] Received Bill.com event:', { eventType, billInvoiceId, billStatus, dueAmount })

    if (!billInvoiceId) {
      console.warn('[Webhook] Missing invoice ID in payload:', payload)
      return NextResponse.json({ error: 'Missing invoice id' }, { status: 400 })
    }

    // Find invoice by bill_ar_invoice_id
    const { data: dbInvoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('id, payment_status, bill_ar_invoice_id')
      .eq('bill_ar_invoice_id', billInvoiceId)
      .single()

    if (invoiceError || !dbInvoice) {
      console.warn('[Webhook] Invoice not found for Bill ID:', billInvoiceId)
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    console.log('[Webhook] Found invoice:', dbInvoice.id, 'current status:', dbInvoice.payment_status)

    // Check if payment is confirmed
    // Bill.com status can be: DRAFT, SENT, VIEWED, PARTIALLY_PAID, PAID_IN_FULL, OVERDUE, etc.
    const isPaymentConfirmed =
      billStatus === 'PAID_IN_FULL' ||
      (dueAmount !== undefined && dueAmount === 0)

    if (isPaymentConfirmed) {
      // Skip if already paid
      if (dbInvoice.payment_status === 'paid') {
        console.log('[Webhook] Invoice already paid:', dbInvoice.id)
        return NextResponse.json({ ok: true, message: 'Invoice already paid' }, { status: 200 })
      }

      console.log('[Webhook] Updating invoice to paid:', dbInvoice.id)

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
        console.error('[Webhook] Update failed:', updateError)
        return NextResponse.json({ error: 'Update failed: ' + updateError.message }, { status: 500 })
      }

      console.log('[Webhook] ✅ Invoice marked as paid:', dbInvoice.id)
      return NextResponse.json({
        ok: true,
        message: 'Invoice marked as paid',
        invoiceId: dbInvoice.id,
        timestamp: new Date().toISOString(),
      })
    }

    // Handle other invoice events
    if (eventType === 'invoice.updated') {
      console.log('[Webhook] Invoice updated:', dbInvoice.id, 'status:', billStatus)
      
      // Update status to awaiting_payment if it was unbilled and now sent
      if (dbInvoice.payment_status === 'unbilled' && (billStatus === 'SENT' || billStatus === 'VIEWED')) {
        try {
          await supabaseAdmin
            .from('invoices')
            .update({ payment_status: 'awaiting_payment', updated_at: new Date().toISOString() })
            .eq('id', dbInvoice.id)
          console.log('[Webhook] Invoice updated to awaiting_payment')
        } catch (err) {
          console.warn('[Webhook] Failed to update to awaiting_payment:', err instanceof Error ? err.message : 'Unknown error')
        }
      }
    }

    if (eventType === 'payment.updated') {
      console.log('[Webhook] Payment updated for invoice:', dbInvoice.id, 'status:', billStatus)
    }

    return NextResponse.json({ ok: true, message: 'Webhook processed', eventType })
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[Webhook] Error:', errorMsg)
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

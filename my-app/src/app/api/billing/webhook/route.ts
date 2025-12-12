import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()

    const billInvoiceId = payload?.data?.invoiceId || payload?.invoiceId || payload?.id
    const eventType = payload?.eventType || payload?.type
    const status = payload?.data?.status || payload?.status

    if (!billInvoiceId) {
      return NextResponse.json({ error: 'Missing invoice id' }, { status: 400 })
    }

    const { data: invoice, error } = await supabaseAdmin
      .from('invoices')
      .select('id, payment_status')
      .eq('bill_ar_invoice_id', billInvoiceId)
      .single()

    if (error || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (
      eventType === 'invoice.paid' ||
      status === 'paid' ||
      status === 'Paid' ||
      eventType === 'payment.completed'
    ) {
      const { error: updateError } = await supabaseAdmin
        .from('invoices')
        .update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoice.id)

      if (updateError) {
        return NextResponse.json({ error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({ ok: true, message: 'Invoice marked as paid' }, { status: 200 })
    }

    return NextResponse.json({ ok: true, message: 'Webhook received' }, { status: 200 })

  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Webhook error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Bill.com webhook endpoint is ready',
    timestamp: new Date().toISOString(),
  })
}

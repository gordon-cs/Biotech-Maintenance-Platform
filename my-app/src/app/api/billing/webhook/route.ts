import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/**
 * Verify the webhook signature from Bill.com
 * Bill.com sends a signature in the X-Bill-Signature header
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    console.error('Missing webhook signature header')
    return false
  }

  // Create HMAC-SHA256 hash of the payload
  const hmac = createHmac('sha256', secret)
  hmac.update(payload)
  const expectedSignature = hmac.digest('hex')

  // Compare signatures using timing-safe comparison
  try {
    // Convert both strings to buffers for timing-safe comparison
    const sigBuffer = Buffer.from(signature, 'hex')
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')
    
    // Ensure both buffers are the same length before comparison
    if (sigBuffer.length !== expectedBuffer.length) {
      return false
    }
    
    // Use crypto.timingSafeEqual for timing-safe comparison
    return timingSafeEqual(sigBuffer, expectedBuffer)
  } catch (error) {
    console.error('Signature comparison failed:', error)
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    // Get the raw body for signature verification
    const rawBody = await req.text()
    
    // Verify webhook signature
    const webhookSecret = process.env.BILL_WEBHOOK_SECRET
    
    if (!webhookSecret) {
      console.error('BILL_WEBHOOK_SECRET is not configured')
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      )
    }

    const signature = req.headers.get('x-bill-signature')
    
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      console.error('Invalid webhook signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Parse the payload after verification
    const payload = JSON.parse(rawBody)
    console.log('Bill.com webhook payload:', payload)

    const billInvoiceId = payload?.data?.invoiceId || payload?.invoiceId || payload?.id
    const eventType = payload?.eventType || payload?.type
    const status = payload?.data?.status || payload?.status

    console.log('Webhook data:', {
      billInvoiceId,
      eventType,
      status,
    })

    if (!billInvoiceId) {
      console.error('Missing invoice ID in webhook')
      return NextResponse.json({ error: 'Missing invoice id' }, { status: 400 })
    }

    const { data: invoice, error } = await supabaseAdmin
      .from('invoices')
      .select('id, payment_status')
      .eq('bill_ar_invoice_id', billInvoiceId)
      .single()

    if (error || !invoice) {
      console.error('Invoice not found for webhook id:', billInvoiceId, error)
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    console.log('Found invoice:', invoice.id, 'Current status:', invoice.payment_status)

    if (
      eventType === 'invoice.paid' ||
      status === 'paid' ||
      status === 'Paid' ||
      eventType === 'payment.completed'
    ) {
      console.log('Invoice paid! Updating status...')

      const { error: updateError } = await supabaseAdmin
        .from('invoices')
        .update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoice.id)

      if (updateError) {
        console.error('Update failed:', updateError)
        return NextResponse.json({ error: 'Update failed' }, { status: 500 })
      }

      console.log('Invoice marked as paid:', invoice.id)
      return NextResponse.json({ ok: true, message: 'Invoice marked as paid' }, { status: 200 })
    }

    console.log('Webhook received but no action needed for event:', eventType)
    return NextResponse.json({ ok: true, message: 'Webhook received' }, { status: 200 })

  } catch (e: unknown) {
    console.error('Webhook error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Webhook error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Bill.com webhook endpoint is ready',
    timestamp: new Date().toISOString(),
  })
}

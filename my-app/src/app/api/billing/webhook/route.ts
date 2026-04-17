import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEBUG = process.env.DEBUG === 'true'
const log = (msg: string) => DEBUG && console.log(msg)

// Verify webhook signature from Bill.com
function verifyWebhookSignature(
  payload: string,
  signature: string,
  securityKey: string
): boolean {
  const hash = crypto
    .createHmac('sha256', securityKey)
    .update(payload)
    .digest('base64')

  return hash === signature
}

export async function POST(request: NextRequest) {
  try {
    log('[Billing Webhook] Received webhook from Bill.com')

    // Get the raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get('X-Bill-Signature')

    if (!signature) {
      log('[Billing Webhook] Missing signature header - rejecting webhook')
      return NextResponse.json(
        { error: 'Missing signature header' },
        { status: 401 }
      )
    }

    // Try multiple possible security keys
    const possibleKeys: string[] = [
      process.env.BILL_SUBSCRIPTION_SECURITY_KEY,  // From subscription response
      process.env.BILL_DEVELOPER_KEY,               // Fallback
    ].filter((v): v is string => !!v)

    log('[Billing Webhook] Verifying signature with ' + possibleKeys.length + ' keys')

    let signatureValid = false

    for (const key of possibleKeys) {
      if (verifyWebhookSignature(rawBody, signature, key)) {
        signatureValid = true
        log('[Billing Webhook] ✓ Signature verified successfully')
        break
      }
    }

    if (!signatureValid) {
      console.error('[Billing Webhook] ✗ Invalid signature - rejecting webhook')
      console.error('[Billing Webhook] Received signature:', signature)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    const event = JSON.parse(rawBody) as {
      type?: string
      id?: string
      data?: {
        eventId?: string
        resource?: {
          id?: string
          status?: string
          paid?: number
          amount?: number
          amountPaid?: number
          customFields?: Array<{ key: string; value: string }>
        }
      }
    }

    log('[Billing Webhook] Event type: ' + event.type)

    // Handle invoice.updated events
    if (event.type === 'invoice.updated' && event.data?.resource?.id) {
      const billInvoiceId = event.data.resource.id
      const invoiceStatus = event.data.resource.status || 'unknown'
      const isPaid = event.data.resource.paid === 1 || event.data.resource.amountPaid === event.data.resource.amount

      log('[Billing Webhook] Processing invoice update: billInvoiceId=' + billInvoiceId + ', isPaid=' + isPaid + ', status=' + invoiceStatus)

      // Find invoice in our database by bill_ar_invoice_id
      const { data: invoice, error: invoiceError } = await supabaseAdmin
        .from('invoices')
        .select('id, payment_status')
        .eq('bill_ar_invoice_id', billInvoiceId)
        .single()

      if (invoiceError) {
        log('[Billing Webhook] Invoice not found in database: ' + billInvoiceId)
        return NextResponse.json({ success: true }) // Still return 200 to acknowledge
      }

      // Update payment status based on Bill.com status
      let newStatus = invoice.payment_status

      if (isPaid) {
        newStatus = 'paid'
      } else if (invoiceStatus === 'shipped' || invoiceStatus === 'sent') {
        newStatus = 'awaiting_payment'
      }

      log('[Billing Webhook] Updating invoice ' + invoice.id + ' to status: ' + newStatus)

      const updateData: Record<string, unknown> = {
        payment_status: newStatus,
        updated_at: new Date().toISOString(),
      }

      if (newStatus === 'paid') {
        updateData.paid_at = new Date().toISOString()
      }

      const { error: updateError } = await supabaseAdmin
        .from('invoices')
        .update(updateData)
        .eq('id', invoice.id)

      if (updateError) {
        console.error('[Billing Webhook] Failed to update invoice:', updateError)
        return NextResponse.json(
          { error: 'Failed to update invoice' },
          { status: 500 }
        )
      }

      log('[Billing Webhook] Successfully updated invoice: ' + invoice.id)
    }

    // Handle payment.updated events
    if (event.type === 'payment.updated' && event.data?.resource?.id) {
      log('[Billing Webhook] Processing payment update: ' + event.data.resource.id)
      // Additional payment processing can be added here if needed
    }

    return NextResponse.json({ success: true, acknowledged: true })
  } catch (error) {
    console.error('[Billing Webhook] Error:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'This endpoint receives webhooks from Bill.com',
    events: ['invoice.updated', 'payment.updated'],
  })
}

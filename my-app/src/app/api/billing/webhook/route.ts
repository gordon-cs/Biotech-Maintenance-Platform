import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/**
 * Verify the webhook signature from Bill.com
 * 
 * Note: This implementation assumes Bill.com sends the signature in hex format.
 * If Bill.com uses a different format (e.g., base64, or with a prefix like 'sha256='),
 * update the signature parsing logic below.
 * 
 * Common header names to check in Bill.com documentation:
 * - X-Bill-Signature
 * - X-Signature
 * - X-Hub-Signature-256
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
  
  // Compare signatures using timing-safe comparison
  try {
    // Check if signature has a format prefix (e.g., 'sha256=')
    const cleanSignature = signature.includes('=') && signature.split('=')[0].match(/^[a-z0-9]+$/i)
      ? signature.split('=')[1]
      : signature
    
    // Determine the expected signature buffer
    const expectedBuffer = hmac.digest()
    
    // Try to parse signature in different formats
    let sigBuffer: Buffer
    
    // Check the length to determine format:
    // Hex: 64 chars for SHA-256 (32 bytes * 2)
    // Base64: 44 chars for SHA-256 (32 bytes encoded)
    if (cleanSignature.length === 64 && /^[0-9a-f]+$/i.test(cleanSignature)) {
      // Likely hex format
      sigBuffer = Buffer.from(cleanSignature, 'hex')
    } else if (cleanSignature.length === 44 || /[+/=]/.test(cleanSignature)) {
      // Likely base64 format
      sigBuffer = Buffer.from(cleanSignature, 'base64')
    } else {
      // Try hex first, then base64
      try {
        sigBuffer = Buffer.from(cleanSignature, 'hex')
        if (sigBuffer.length !== expectedBuffer.length) {
          sigBuffer = Buffer.from(cleanSignature, 'base64')
        }
      } catch {
        sigBuffer = Buffer.from(cleanSignature, 'base64')
      }
    }
    
    // Ensure both buffers are the same length before comparison
    if (sigBuffer.length !== expectedBuffer.length) {
      console.error('Signature length mismatch:', sigBuffer.length, 'vs', expectedBuffer.length)
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

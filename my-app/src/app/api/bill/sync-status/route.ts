import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { billClient } from '@/lib/billClient'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEBUG = process.env.DEBUG === 'true'
const log = (msg: string) => DEBUG && console.log(msg)

function getBillAppBaseUrl(): string {
  const configured = process.env.BILL_APP_BASE_URL?.trim()
  if (configured) {
    return configured.replace(/\/$/, '')
  }

  const gatewayBase = process.env.BILL_BASE_URL || ''
  if (/stage/i.test(gatewayBase)) {
    return 'https://app-stage02.us.bill.com'
  }

  return 'https://app.bill.com'
}

function buildGuestPaymentUrlFromInvoiceId(billArInvoiceId: string | null | undefined): string | null {
  if (!billArInvoiceId || typeof billArInvoiceId !== 'string') {
    return null
  }

  const normalized = billArInvoiceId.trim()
  if (!normalized) {
    return null
  }

  const baseUrl = getBillAppBaseUrl()
  return `${baseUrl}/app/arp/guest/session/pay/${encodeURIComponent(normalized)}?paymentLinkSource=Webapp`
}

export async function POST(request: NextRequest) {
  try {
    const { invoiceId, billArInvoiceId } = await request.json()

    log(`[Sync Status] ===== START SYNC FOR INVOICE ${invoiceId} =====`)

    if (!invoiceId && !billArInvoiceId) {
      log('[Sync Status] Missing invoiceId')
      return NextResponse.json(
        { error: 'Missing invoiceId or billArInvoiceId' },
        { status: 400 }
      )
    }

    // Auth: supports two methods:
    //   Bearer token (user-initiated):   Authorization: Bearer <supabase_access_token>
    //   API key (cron/background sync):  x-api-key: <SYNC_API_KEY env var>
    const authHeader = request.headers.get('authorization')
    const apiKey = request.headers.get('x-api-key')

    if (!authHeader && !apiKey) {
      console.warn('[Sync Status] Missing authorization header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (apiKey) {
      // API-key path: used by cron jobs or background sync services
      const validApiKey = process.env.SYNC_API_KEY
      const keyMatches =
        validApiKey &&
        apiKey.length === validApiKey.length &&
        timingSafeEqual(Buffer.from(apiKey), Buffer.from(validApiKey))
      if (!keyMatches) {
        console.warn('[Sync Status] Invalid API key')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      log('[Sync Status] Authenticated via API key')
    } else {
      // Bearer token path: used by authenticated users in the UI
      const token = authHeader!.replace('Bearer ', '')

      try {
        // Create client with the provided token
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { 
            global: { 
              headers: { Authorization: `Bearer ${token}` } 
            } 
          }
        )

        // Verify the user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          log('[Sync Status] Auth failed: ' + authError?.message)
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        log(`[Sync Status] User authenticated: ${user.id}`)
      } catch (tokenError) {
        log('[Sync Status] Token handling error: ' + (tokenError instanceof Error ? tokenError.message : String(tokenError)))
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
      }
    }

    // Resolve local invoice by local id first, then by Bill invoice id fallback.
    let invoice: {
      id: number
      bill_ar_invoice_id: string | null
      payment_status: string
      payment_url: string | null
    } | null = null

    const parsedInvoiceId =
      typeof invoiceId === 'number'
        ? invoiceId
        : typeof invoiceId === 'string' && invoiceId.trim() !== '' && Number.isFinite(Number(invoiceId))
          ? Number(invoiceId)
          : null

    if (parsedInvoiceId !== null) {
      const { data: byLocalId } = await supabaseAdmin
        .from('invoices')
        .select('id, bill_ar_invoice_id, payment_status, payment_url')
        .eq('id', parsedInvoiceId)
        .maybeSingle()

      invoice = byLocalId
    }

    if (!invoice) {
      const candidateBillInvoiceId =
        typeof billArInvoiceId === 'string' && billArInvoiceId.trim() !== ''
          ? billArInvoiceId.trim()
          : typeof invoiceId === 'string' && invoiceId.trim() !== ''
            ? invoiceId.trim()
            : null

      if (candidateBillInvoiceId) {
        const { data: byBillId } = await supabaseAdmin
          .from('invoices')
          .select('id, bill_ar_invoice_id, payment_status, payment_url')
          .eq('bill_ar_invoice_id', candidateBillInvoiceId)
          .maybeSingle()

        invoice = byBillId
      }
    }

    if (!invoice) {
      const directBillInvoiceId =
        typeof billArInvoiceId === 'string' && billArInvoiceId.trim() !== ''
          ? billArInvoiceId.trim()
          : typeof invoiceId === 'string' && invoiceId.trim() !== ''
            ? invoiceId.trim()
            : null

      if (!directBillInvoiceId) {
        log('[Sync Status] Invoice not found and no Bill.com id available')
        return NextResponse.json(
          { error: 'Invoice not found in database. Please re-open from Payment Requests and try again.' },
          { status: 404 }
        )
      }

      try {
        const billInvoiceData = await billClient.getInvoiceStatus(directBillInvoiceId)
        const paymentUrl = billInvoiceData.paymentUrl || buildGuestPaymentUrlFromInvoiceId(directBillInvoiceId)
        let mappedStatus = 'awaiting_payment'

        if (
          billInvoiceData.paid === 1 ||
          billInvoiceData.status === 'paid' ||
          billInvoiceData.status === 'PAID_IN_FULL' ||
          billInvoiceData.status?.toUpperCase() === 'PAID_IN_FULL'
        ) {
          mappedStatus = 'paid'
        }

        return NextResponse.json({
          status: mappedStatus,
          previousStatus: null,
          statusChanged: false,
          paymentUrl,
          synchronized: true,
          localInvoiceMissing: true,
          billStatus: billInvoiceData.status,
          amount: billInvoiceData.amount,
          amountPaid: billInvoiceData.amountPaid,
        })
      } catch (directBillError) {
        log('[Sync Status] Invoice not found locally and direct Bill.com query failed: ' + (directBillError instanceof Error ? directBillError.message : String(directBillError)))
        return NextResponse.json(
          { error: 'Invoice not found in database and Bill.com lookup failed' },
          { status: 404 }
        )
      }
    }
    log('[Sync Status] Invoice found: id=' + invoice.id + ', bill_id=' + invoice.bill_ar_invoice_id + ', status=' + invoice.payment_status)

    if (!invoice.bill_ar_invoice_id) {
      log('[Sync Status] Invoice has no bill_ar_invoice_id')
      return NextResponse.json(
        { error: 'Invoice not synced with Bill.com' },
        { status: 400 }
      )
    }

    try {
      // Query Bill.com for current invoice status
      log(`[Sync Status] Querying Bill.com for invoice ${invoice.bill_ar_invoice_id}...`)
      const billInvoiceData = await billClient.getInvoiceStatus(invoice.bill_ar_invoice_id)
      log('[Sync Status] Bill.com response: ' + JSON.stringify(billInvoiceData))
      const paymentUrl =
        billInvoiceData.paymentUrl ||
        invoice.payment_url ||
        buildGuestPaymentUrlFromInvoiceId(invoice.bill_ar_invoice_id)

      // Map Bill.com status to our payment status
      let mappedStatus = 'awaiting_payment'
      
      // Check various Bill.com status values for "paid"
      if (billInvoiceData.paid === 1 || 
          billInvoiceData.status === 'paid' || 
          billInvoiceData.status === 'PAID_IN_FULL' ||
          billInvoiceData.status?.toUpperCase() === 'PAID_IN_FULL') {
        mappedStatus = 'paid'
        log(`[Sync Status] Mapped Bill.com status "${billInvoiceData.status}" to: PAID`)
      } else if (billInvoiceData.status === 'draft' || billInvoiceData.status === 'sent' || billInvoiceData.status === 'SENT') {
        mappedStatus = 'awaiting_payment'
        log(`[Sync Status] Mapped Bill.com status "${billInvoiceData.status}" to: AWAITING_PAYMENT`)
      }

      // Update invoice if status changed
      const statusChanged = mappedStatus !== invoice.payment_status

      log(`[Sync Status] Status comparison: Current="${invoice.payment_status}" vs New="${mappedStatus}" - Changed: ${statusChanged}`)

      const paymentUrlChanged = Boolean(paymentUrl && paymentUrl !== invoice.payment_url)

      if (statusChanged || paymentUrlChanged) {
        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        }

        if (statusChanged) {
          updateData.payment_status = mappedStatus
        }

        if (paymentUrlChanged) {
          updateData.payment_url = paymentUrl
        }

        // Add paid_at timestamp if status changed to paid
        if (mappedStatus === 'paid' && invoice.payment_status !== 'paid') {
          updateData.paid_at = new Date().toISOString()
        }

        log('[Sync Status] Updating invoice with: ' + JSON.stringify(updateData))
        const { error: updateError } = await supabaseAdmin
          .from('invoices')
          .update(updateData)
          .eq('id', invoiceId)

        if (updateError) {
          log('[Sync Status] Update failed: ' + updateError.message)
          return NextResponse.json(
            { error: 'Failed to update invoice', details: updateError.message },
            { status: 500 }
          )
        }

        log(`[Sync Status] Invoice ${invoiceId} status updated: ${invoice.payment_status} → ${mappedStatus}`)
      } else {
        log(`[Sync Status] Invoice ${invoiceId} status unchanged: ${mappedStatus}`)
      }

      return NextResponse.json({
        status: mappedStatus,
        previousStatus: invoice.payment_status,
        statusChanged: statusChanged,
        paymentUrl: paymentUrl || null,
        synchronized: true,
        billStatus: billInvoiceData.status,
        amount: billInvoiceData.amount,
        amountPaid: billInvoiceData.amountPaid,
      })
    } catch (billError) {
      log('[Sync Status] Bill.com query failed: ' + (billError instanceof Error ? billError.message : String(billError)))
      // Return current status if Bill.com query fails
      return NextResponse.json({
        status: invoice.payment_status,
        paymentUrl: invoice.payment_url || buildGuestPaymentUrlFromInvoiceId(invoice.bill_ar_invoice_id),
        synchronized: false,
        error: 'Failed to query Bill.com, using cached status'
      }, { status: 200 })
    }
  } catch (error) {
    log('Sync status error: ' + (error instanceof Error ? error.message : String(error)))
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to sync payment status',
      },
      { status: 500 }
    )
  }
}

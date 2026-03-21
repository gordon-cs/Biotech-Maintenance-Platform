import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { billClient } from '@/lib/billClient'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEBUG = process.env.DEBUG === 'true'
const log = (msg: string) => DEBUG && console.log(msg)

/**
 * Sync all pending invoices with Bill.com
 * This can be called by a background job/cron task
 * Authentication: Requires SYNC_API_KEY header
 */
export async function POST(request: NextRequest) {
  try {
    log(`[Sync All Pending] ===== START SYNCING ALL PENDING INVOICES =====`)

    // Verify API key for security
    const apiKey = request.headers.get('x-sync-api-key')
    if (!apiKey || apiKey !== process.env.SYNC_API_KEY) {
      log('[Sync All Pending] Invalid or missing API key')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all invoices with awaiting_payment status that have a bill_ar_invoice_id
    const { data: invoices, error: fetchError } = await supabaseAdmin
      .from('invoices')
      .select('id, bill_ar_invoice_id, payment_status, work_order_id')
      .eq('payment_status', 'awaiting_payment')
      .not('bill_ar_invoice_id', 'is', null)
      .neq('invoice_type', 'initial_fee')

    if (fetchError) {
      log('[Sync All Pending] Failed to fetch invoices: ' + fetchError.message)
      return NextResponse.json(
        { error: 'Failed to fetch invoices', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!invoices || invoices.length === 0) {
      log('[Sync All Pending] No pending invoices to sync')
      return NextResponse.json({
        message: 'No pending invoices to sync',
        syncedCount: 0,
        updatedCount: 0,
      })
    }

    log(`[Sync All Pending] Found ${invoices.length} pending invoices to sync`)

    let syncedCount = 0
    let updatedCount = 0
    const errors: any[] = []

    // Sync all invoices
    for (const invoice of invoices) {
      try {
        log(`[Sync All Pending] Syncing invoice ${invoice.id} (bill_id: ${invoice.bill_ar_invoice_id})...`)

        // Query Bill.com for current status
        const billInvoiceData = await billClient.getInvoiceStatus(invoice.bill_ar_invoice_id)
        syncedCount++

        // Map Bill.com status
        let mappedStatus = 'awaiting_payment'
        if (billInvoiceData.paid === 1 ||
            billInvoiceData.status === 'paid' ||
            billInvoiceData.status === 'PAID_IN_FULL' ||
            billInvoiceData.status?.toUpperCase() === 'PAID_IN_FULL') {
          mappedStatus = 'paid'
        }

        // Update if status changed
        if (mappedStatus !== invoice.payment_status) {
          const updateData: Record<string, unknown> = {
            payment_status: mappedStatus,
            updated_at: new Date().toISOString(),
          }

          if (mappedStatus === 'paid') {
            updateData.paid_at = new Date().toISOString()
          }

          const { error: updateError } = await supabaseAdmin
            .from('invoices')
            .update(updateData)
            .eq('id', invoice.id)

          if (updateError) {
            log(`[Sync All Pending] Update failed for invoice ${invoice.id}: ${updateError.message}`)
            errors.push({
              invoiceId: invoice.id,
              error: updateError.message,
            })
          } else {
            log(`[Sync All Pending] ✓ Invoice ${invoice.id} updated: ${invoice.payment_status} → ${mappedStatus}`)
            updatedCount++
          }
        } else {
          log(`[Sync All Pending] Invoice ${invoice.id} status unchanged: ${mappedStatus}`)
        }
      } catch (err) {
        log(`[Sync All Pending] Error syncing invoice ${invoice.id}: ${err instanceof Error ? err.message : String(err)}`)
        errors.push({
          invoiceId: invoice.id,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    log(`[Sync All Pending] ===== SYNC COMPLETE =====`)
    log(`[Sync All Pending] Synced: ${syncedCount}, Updated: ${updatedCount}, Errors: ${errors.length}`)

    return NextResponse.json({
      message: 'Sync completed',
      syncedCount,
      updatedCount,
      totalInvoices: invoices.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    log('[Sync All Pending] Fatal error: ' + (error instanceof Error ? error.message : String(error)))
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to sync invoices',
      },
      { status: 500 }
    )
  }
}

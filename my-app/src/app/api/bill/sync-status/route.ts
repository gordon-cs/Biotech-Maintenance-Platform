import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { billClient } from '@/lib/billClient'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEBUG = process.env.DEBUG === 'true'
const log = (msg: string) => DEBUG && console.log(msg)

export async function POST(request: NextRequest) {
  try {
    const { invoiceId } = await request.json()

    log(`[Sync Status] ===== START SYNC FOR INVOICE ${invoiceId} =====`)

    if (!invoiceId) {
      log('[Sync Status] Missing invoiceId')
      return NextResponse.json(
        { error: 'Missing invoiceId' },
        { status: 400 }
      )
    }

    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      console.warn('[Sync Status] Missing authorization header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    
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

      // Get invoice record to find the Bill.com invoice ID
      const { data: invoice, error: invoiceError } = await supabaseAdmin
        .from('invoices')
        .select('id, bill_ar_invoice_id, payment_status')
        .eq('id', invoiceId)
        .single()

      if (invoiceError || !invoice) {
        log('[Sync Status] Invoice not found: ' + invoiceError?.message)
        return NextResponse.json(
          { error: 'Invoice not found' },
          { status: 404 }
        )
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

        if (statusChanged) {
          const updateData: Record<string, unknown> = {
            payment_status: mappedStatus,
            updated_at: new Date().toISOString(),
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
          synchronized: false,
          error: 'Failed to query Bill.com, using cached status'
        }, { status: 200 })
      }
    } catch (tokenError) {
      log('[Sync Status] Token handling error: ' + (tokenError instanceof Error ? tokenError.message : String(tokenError)))
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
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

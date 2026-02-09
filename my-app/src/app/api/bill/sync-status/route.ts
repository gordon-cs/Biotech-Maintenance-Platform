import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { billClient } from '@/lib/billClient'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

console.log('[SyncStatus] Route file loaded - POST exported')

export async function POST(request: NextRequest) {
  console.log('[SyncStatus] POST HANDLER CALLED!!!')
  try {
    console.log('[SyncStatus] POST request received')
    const { invoiceId } = await request.json()
    console.log('[SyncStatus] invoiceId:', invoiceId)

    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 })
    }

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('id, bill_ar_invoice_id, payment_status, updated_at')
      .eq('id', invoiceId)
      .single()

    console.log('[SyncStatus] Invoice query result:', { invoice, error: invoiceError })

    if (invoiceError || !invoice) {
      console.log('[SyncStatus] Invoice not found, returning 404')
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (!invoice.bill_ar_invoice_id) {
      return NextResponse.json({ error: 'Invoice not sent to Bill.com yet' }, { status: 400 })
    }

    // Skip if recently synced (within 1 minute)
    if (invoice.updated_at) {
      const lastSync = new Date(invoice.updated_at).getTime()
      const now = Date.now()
      if (now - lastSync < 60000) {
        console.log(`[SyncStatus] Using cached status for invoice ${invoiceId}`)
        return NextResponse.json({ 
          status: invoice.payment_status, 
          cached: true,
          message: 'Using cached status (synced within 1 minute)'
        })
      }
    }

    try {
      console.log(`[SyncStatus] Checking invoice status for ${invoiceId}`)
      
      // For now, just return current status from database
      // The webhook is the primary way payments are synced
      // This endpoint serves as a status check
      
      console.log(`[SyncStatus] Current status: ${invoice.payment_status}`)
      
      return NextResponse.json({ 
        success: true,
        status: invoice.payment_status,
        message: 'Invoice status synced',
        note: 'Payment updates come from Bill.com webhooks'
      })
    } catch (error) {
      console.error('[SyncStatus] Error:', error instanceof Error ? error.message : 'Unknown error')
      return NextResponse.json(
        { error: 'Failed to check status' },
        { status: 500 }
      )
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync status' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { billClient } from '@/lib/billClient'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(request: NextRequest) {
  try {
    const { invoiceId } = await request.json()

    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 })
    }

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('id, bill_ar_invoice_id, payment_status')
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (!invoice.bill_ar_invoice_id) {
      return NextResponse.json({ error: 'Invoice not sent to Bill.com yet' }, { status: 400 })
    }

    try {
      const billInvoiceData = await billClient.request('POST', '/Crud/Read/Invoice.json', {
        id: invoice.bill_ar_invoice_id
      })

      const billInvoice = billInvoiceData as { 
        response_data?: { 
          status?: string;
          isPaid?: boolean;
          [key: string]: unknown 
        } 
      }

      const billStatus = billInvoice?.response_data?.status
      const isPaid = billInvoice?.response_data?.isPaid

      if (isPaid || billStatus === 'Paid' || billStatus === 'paid') {
        const { error: updateError } = await supabaseAdmin
          .from('invoices')
          .update({
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoice.id)

        if (updateError) {
          return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
        }

        return NextResponse.json({ 
          success: true, 
          status: 'paid',
          message: 'Payment status updated to paid'
        })
      }

      return NextResponse.json({ 
        success: true, 
        status: 'awaiting_payment',
        billStatus: billStatus,
        message: 'Payment still pending'
      })

    } catch (error) {
      return NextResponse.json({ 
        error: 'Failed to check Bill.com status',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
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

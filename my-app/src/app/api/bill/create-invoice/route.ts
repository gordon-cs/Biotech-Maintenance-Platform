import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { billClient } from '@/lib/billClient'
import { resolveBillPaymentUrl } from '@/lib/billPaymentLink'

// Create admin client for bypassing RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

  return `${getBillAppBaseUrl()}/app/arp/guest/session/pay/${encodeURIComponent(normalized)}?paymentLinkSource=Webapp`
}

export async function POST(request: NextRequest) {
  try {
    const { invoiceId } = await request.json()
    
    if (
      invoiceId === undefined ||
      invoiceId === null ||
      (typeof invoiceId !== 'number' && typeof invoiceId !== 'string') ||
      (typeof invoiceId === 'string' && invoiceId.trim() === '') ||
      (typeof invoiceId === 'number' && !Number.isFinite(invoiceId))
    ) {
      return NextResponse.json({ error: 'Invalid or missing invoiceId' }, { status: 400 })
    }

    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const { data: workOrder, error: woError } = await supabaseAdmin
      .from('work_orders')
      .select('id, title, description, initial_fee')
      .eq('id', invoice.work_order_id)
      .single()

    if (woError || !workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    const { data: lab, error: labError } = await supabaseAdmin
      .from('labs')
      .select('id, name, bill_customer_id, manager_id')
      .eq('id', invoice.lab_id)
      .single()

    if (labError || !lab) {
      return NextResponse.json({ error: 'Lab not found' }, { status: 404 })
    }

    const isAdmin = (profile.role || '').toString().toLowerCase() === 'admin'
    const isLabManager = user.id === lab.manager_id

    if (!isAdmin && !isLabManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: manager, error: managerError } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', lab.manager_id)
      .single()

    if (managerError || !manager?.email) {
      return NextResponse.json(
        { error: 'Lab manager email not configured. Please set a manager for this lab.' },
        { status: 400 }
      )
    }

    if (!invoice.total_amount || Number(invoice.total_amount) <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    if (invoice.bill_ar_invoice_id) {
      const paymentUrl =
        resolveBillPaymentUrl(invoice) ||
        buildGuestPaymentUrlFromInvoiceId(invoice.bill_ar_invoice_id)
      const invoiceUpdates: {
        payment_status?: 'awaiting_payment'
        payment_url?: string
        updated_at?: string
      } = {}

      if (invoice.payment_status === 'unbilled') {
        invoiceUpdates.payment_status = 'awaiting_payment'
      }

      if (paymentUrl && invoice.payment_url !== paymentUrl) {
        invoiceUpdates.payment_url = paymentUrl
      }

      if (Object.keys(invoiceUpdates).length > 0) {
        invoiceUpdates.updated_at = new Date().toISOString()

        let { error: existingUpdateError } = await supabaseAdmin
          .from('invoices')
          .update(invoiceUpdates)
          .eq('id', invoiceId)

        // Backward-compatible fallback when payment_url column is not yet migrated.
        if (existingUpdateError && invoiceUpdates.payment_url && /payment_url/i.test(existingUpdateError.message)) {
          const { payment_url: _ignorePaymentUrl, ...fallbackUpdates } = invoiceUpdates
          const fallbackResult = await supabaseAdmin
            .from('invoices')
            .update(fallbackUpdates)
            .eq('id', invoiceId)
          existingUpdateError = fallbackResult.error
        }

        if (existingUpdateError) {
          return NextResponse.json({ error: existingUpdateError.message }, { status: 500 })
        }
      }

      return NextResponse.json(
        {
          success: true,
          arInvoiceId: invoice.bill_ar_invoice_id,
          paymentUrl,
          alreadyCreated: true,
        },
        { status: 200 }
      )
    }

    let billCustomerId: string | null = lab.bill_customer_id

    if (!billCustomerId || !billCustomerId.startsWith('0cu')) {
      const newCustomer = await billClient.createCustomer({
        name: lab.name ?? 'Lab Customer',
        email: manager?.email ?? 'no-reply@example.com',
      })

      billCustomerId = newCustomer.id

      await supabaseAdmin
        .from('labs')
        .update({ bill_customer_id: billCustomerId })
        .eq('id', lab.id)
    }
    const today = new Date()
    const invoiceDate = today.toISOString().split('T')[0]
    const dueDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    const invoiceType = invoice.invoice_type || 'service'
    const isInitialFee = invoiceType === 'initial_fee'
    
    const description = isInitialFee 
      ? `Platform Fee - ${workOrder.title || 'Work Order'}`
      : `Service Fee - ${workOrder.title || 'Work Order'}`
    
    // Use the local invoice id to keep Bill.com invoice numbers unique and idempotent per invoice record.
    const invoiceNumber = isInitialFee
      ? `WO-${workOrder.id}-INITIAL-INV-${invoice.id}`
      : `WO-${workOrder.id}-SERVICE-INV-${invoice.id}`

    const arInvoice = await billClient.createARInvoice({
      customerId: billCustomerId!,
      invoiceNumber: invoiceNumber,
      invoiceDate,
      dueDate,
      description: description,
      amount: Number(invoice.total_amount),
      customerEmail: manager.email,
      customerName: manager.full_name || lab.name,
    }).catch(async (createError: unknown) => {
      const createErrorMessage = createError instanceof Error ? createError.message : String(createError)
      const duplicateInvoiceError = /duplicate|already exists|invoice number|BDC_1171/i.test(createErrorMessage)

      if (!duplicateInvoiceError) {
        throw createError
      }

      console.warn('[bill/create-invoice] Duplicate invoice detected, attempting recovery lookup:', {
        invoiceId: invoice.id,
        invoiceNumber,
      })

      const candidateInvoiceNumbers = Array.from(
        new Set(
          [
            invoiceNumber,
            isInitialFee ? `WO-${workOrder.id}-INITIAL` : `WO-${workOrder.id}-SERVICE`,
            `WO-${workOrder.id}`,
          ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim()))
        )
      )

      let existingArInvoice: Awaited<ReturnType<typeof billClient.findARInvoiceByNumber>> = null

      for (const candidateInvoiceNumber of candidateInvoiceNumbers) {
        existingArInvoice = await billClient.findARInvoiceByNumber(candidateInvoiceNumber, billCustomerId!)
        if (existingArInvoice?.id) {
          break
        }
      }

      if (!existingArInvoice?.id) {
        throw new Error(
          `Bill.com reported duplicate invoice number (${invoiceNumber}), but no existing invoice was found for tried numbers: ${candidateInvoiceNumbers.join(', ')}. ${createErrorMessage}`
        )
      }

      const recoveredPaymentUrl = resolveBillPaymentUrl(existingArInvoice)

      const recoveredInvoiceUpdates: {
        bill_ar_invoice_id: string
        payment_status: 'awaiting_payment'
        updated_at: string
        payment_url?: string
      } = {
        bill_ar_invoice_id: existingArInvoice.id,
        payment_status: 'awaiting_payment',
        updated_at: new Date().toISOString(),
      }

      if (recoveredPaymentUrl) {
        recoveredInvoiceUpdates.payment_url = recoveredPaymentUrl
      }

      let { error: recoveredUpdateError } = await supabaseAdmin
        .from('invoices')
        .update(recoveredInvoiceUpdates)
        .eq('id', invoiceId)

      // Backward-compatible fallback when payment_url column is not yet migrated.
      if (
        recoveredUpdateError &&
        recoveredInvoiceUpdates.payment_url &&
        /payment_url/i.test(recoveredUpdateError.message)
      ) {
        const { payment_url: _ignorePaymentUrl, ...fallbackUpdates } = recoveredInvoiceUpdates
        const fallbackResult = await supabaseAdmin
          .from('invoices')
          .update(fallbackUpdates)
          .eq('id', invoiceId)
        recoveredUpdateError = fallbackResult.error
      }

      if (recoveredUpdateError) {
        throw new Error(recoveredUpdateError.message)
      }

      return {
        id: existingArInvoice.id,
        paymentUrl: recoveredPaymentUrl,
        alreadyCreated: true,
      }
    })

    const paymentUrl = resolveBillPaymentUrl(arInvoice)
    const effectivePaymentUrl = paymentUrl || buildGuestPaymentUrlFromInvoiceId(arInvoice.id)

    const invoiceUpdates: {
      bill_ar_invoice_id: string
      payment_status: 'awaiting_payment'
      updated_at: string
      payment_url?: string
    } = {
      bill_ar_invoice_id: arInvoice.id,
      payment_status: 'awaiting_payment',
      updated_at: new Date().toISOString(),
    }

    if (effectivePaymentUrl) {
      invoiceUpdates.payment_url = effectivePaymentUrl
    }

    let { error: updateError } = await supabaseAdmin
      .from('invoices')
      .update(invoiceUpdates)
      .eq('id', invoiceId)

    // Backward-compatible fallback when payment_url column is not yet migrated.
    if (updateError && invoiceUpdates.payment_url && /payment_url/i.test(updateError.message)) {
      const { payment_url: _ignorePaymentUrl, ...fallbackUpdates } = invoiceUpdates
      const fallbackResult = await supabaseAdmin
        .from('invoices')
        .update(fallbackUpdates)
        .eq('id', invoiceId)
      updateError = fallbackResult.error
    }

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json(
      {
        success: true,
        arInvoiceId: arInvoice.id,
        paymentUrl: effectivePaymentUrl,
        alreadyCreated: 'alreadyCreated' in arInvoice && arInvoice.alreadyCreated === true,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error('[bill/create-invoice] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create AR invoice'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  )
}

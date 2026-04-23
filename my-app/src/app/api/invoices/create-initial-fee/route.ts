import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { billClient } from '@/lib/billClient'
import { resolveBillPaymentUrl } from '@/lib/billPaymentLink'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }) as Promise<T>
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { workOrderId } = await request.json()

    if (!workOrderId || typeof workOrderId !== 'number') {
      return NextResponse.json({ error: 'Invalid workOrderId' }, { status: 400 })
    }

    const { data: workOrder, error: woError } = await supabaseAdmin
      .from('work_orders')
      .select('id, title, lab, initial_fee, created_by')
      .eq('id', workOrderId)
      .single()

    if (woError || !workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: lab, error: labError } = await supabaseAdmin
      .from('labs')
      .select('id, name, bill_customer_id, manager_id')
      .eq('id', workOrder.lab)
      .single()

    if (labError || !lab) {
      return NextResponse.json({ error: 'Lab not found' }, { status: 404 })
    }

    const isAdmin = (profile?.role || '').toString().toLowerCase() === 'admin'
    const isLabManager = user.id === lab.manager_id
    const isWorkOrderCreator = user.id === workOrder.created_by

    if (!isAdmin && !isLabManager && !isWorkOrderCreator) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const initialFee = workOrder.initial_fee || 50.00

    const { data: manager, error: managerError } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', lab.manager_id)
      .single()

    if (managerError || !manager?.email) {
      return NextResponse.json(
        { error: 'Lab manager email not configured' },
        { status: 400 }
      )
    }

    const { data: existingInvoice, error: existingInvoiceError } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('work_order_id', workOrderId)
      .eq('invoice_type', 'initial_fee')
      .maybeSingle()

    if (existingInvoiceError) {
      return NextResponse.json({ error: existingInvoiceError.message }, { status: 500 })
    }

    let invoice = existingInvoice ?? null

    if (invoice?.bill_ar_invoice_id) {
      const paymentUrl = resolveBillPaymentUrl(invoice)
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

        const { error: existingUpdateError } = await supabaseAdmin
          .from('invoices')
          .update(invoiceUpdates)
          .eq('id', invoice.id)

        if (existingUpdateError) {
          return NextResponse.json({ error: existingUpdateError.message }, { status: 500 })
        }
      }

      return NextResponse.json({
        invoiceId: invoice.id,
        alreadyCreated: true,
        message: 'Initial fee invoice already exists in Bill.com'
      })
    }

    if (!invoice) {
      const { data: insertedInvoice, error: invoiceError } = await supabaseAdmin
        .from('invoices')
        .insert({
          work_order_id: workOrderId,
          lab_id: workOrder.lab,
          created_by: workOrder.created_by,
          total_amount: initialFee,
          payment_status: 'unbilled',
          invoice_type: 'initial_fee'
        })
        .select()
        .single()

      if (invoiceError || !insertedInvoice) {
        return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
      }

      invoice = insertedInvoice
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

    if (!billCustomerId) {
      return NextResponse.json({ error: 'Failed to create Bill.com customer' }, { status: 500 })
    }

    const today = new Date()
    const invoiceDate = today.toISOString().split('T')[0]
    const dueDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    // Create invoice in Bill.com
    const invoiceNumber = `WO-${workOrderId}-INITIAL-INV-${invoice.id}`

    const billInvoice = await billClient.createARInvoice({
      customerId: billCustomerId,
      invoiceNumber,
      invoiceDate,
      dueDate,
      description: `Initial Fee - ${workOrder.title || 'Work Order'}`,
      amount: Number(initialFee),
      customerEmail: manager.email,
      customerName: manager.full_name || lab.name,
    }).catch(async (createError: unknown) => {
      const createErrorMessage = createError instanceof Error ? createError.message : String(createError)
      const duplicateInvoiceError = /duplicate|already exists|invoice number|BDC_1171/i.test(createErrorMessage)

      if (!duplicateInvoiceError) {
        throw createError
      }

      console.warn('[create-initial-fee] Duplicate invoice detected, attempting recovery lookup:', {
        workOrderId,
        invoiceNumber,
      })

      const candidateInvoiceNumbers = Array.from(
        new Set(
          [
            invoiceNumber,
            `WO-${workOrderId}-INITIAL`,
            `WO-${workOrderId}`,
          ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim()))
        )
      )

      let existingBillInvoice = null as Awaited<ReturnType<typeof billClient.findARInvoiceByNumber>>

      for (const candidateInvoiceNumber of candidateInvoiceNumbers) {
        existingBillInvoice = await withTimeout(
          billClient.findARInvoiceByNumber(candidateInvoiceNumber, billCustomerId),
          15000,
          '[create-initial-fee] Bill invoice lookup'
        ).catch((lookupError) => {
          console.warn('[create-initial-fee] Bill invoice lookup timed out or failed:', lookupError)
          return null
        })
        if (existingBillInvoice?.id) {
          break
        }
      }

      if (!existingBillInvoice?.id) {
        throw new Error(
          `Bill.com reported duplicate invoice number (${invoiceNumber}), but no existing invoice was found for tried numbers: ${candidateInvoiceNumbers.join(', ')}. ${createErrorMessage}`
        )
      }

      return existingBillInvoice
    })

    const paymentUrl = resolveBillPaymentUrl(billInvoice)

    // Update invoice with Bill.com ID
    const { error: updateError } = await supabaseAdmin
      .from('invoices')
      .update({
        bill_ar_invoice_id: billInvoice.id,
        payment_url: paymentUrl,
        payment_status: 'awaiting_payment',
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      invoiceId: invoice.id,
      message: 'Initial fee invoice created'
    })
  } catch (error) {
    console.error('Error creating initial fee invoice:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

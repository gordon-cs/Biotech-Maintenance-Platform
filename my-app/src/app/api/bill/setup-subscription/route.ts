import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    console.log('[SetupSubscription] Starting Bill.com subscription setup')

    // Get credentials
    const devKey = process.env.BILL_DEVELOPER_KEY
    const orgId = process.env.BILL_ORGANIZATION_ID
    const baseUrl = process.env.BILL_BASE_URL || 'https://gateway.stage.bill.com/connect/v3'
    const username = process.env.BILL_USERNAME
    const password = process.env.BILL_PASSWORD

    if (!devKey || !orgId || !username || !password) {
      return NextResponse.json(
        { error: 'Missing Bill.com credentials' },
        { status: 400 }
      )
    }

    // Step 1: Login to get sessionId
    console.log('[SetupSubscription] Logging in to Bill.com')
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
        devKey,
        organizationId: orgId,
      }),
    })

    const loginData = await loginRes.json() as { 
      response_data?: { sessionId?: string }
      sessionId?: string
    }
    const sessionId = loginData?.sessionId || loginData?.response_data?.sessionId

    if (!sessionId) {
      console.error('[SetupSubscription] Failed to get sessionId:', loginData)
      return NextResponse.json(
        { error: 'Failed to authenticate with Bill.com' },
        { status: 401 }
      )
    }

    console.log('[SetupSubscription] Got sessionId successfully')

    console.log('[SetupSubscription] Got sessionId, creating subscription')

    // Subscribe to invoice update events - this fires when invoices are marked as paid
    const eventsToSubscribe = [
      { type: 'invoice.updated', version: '1' },
      { type: 'payment.updated', version: '1' },
    ]

    // Step 2: Create subscription
    const notificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'}/api/billing/webhook`
    
    // Generate proper UUID format for idempotent key
    const generateUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })
    }
    const idempotentKey = generateUUID()

    console.log('[SetupSubscription] Creating subscription with idempotent key:', idempotentKey)

    const subscriptionRes = await fetch(
      'https://gateway.stage.bill.com/connect-events/v3/subscriptions',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Idempotent-Key': idempotentKey,
          'devKey': devKey,
          'sessionId': sessionId,
        },
        body: JSON.stringify({
          name: 'Invoice Payment Sync',
          status: {
            enabled: true,
          },
          events: eventsToSubscribe,
          notificationUrl,
        }),
      }
    )

    const subscriptionData = await subscriptionRes.json() as {
      id?: string
      securityKey?: string
      error?: string
    }

    if (!subscriptionData.id) {
      console.error('[SetupSubscription] Failed to create subscription:', subscriptionData)
      return NextResponse.json(
        { error: 'Failed to create subscription', details: subscriptionData },
        { status: 500 }
      )
    }

    console.log('[SetupSubscription] Subscription created:', subscriptionData.id)

    // Step 3: Store subscription details
    const { error: storageError } = await supabaseAdmin
      .from('system_config')
      .upsert({
        key: 'bill_subscription_id',
        value: subscriptionData.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })

    if (storageError) {
      console.warn('[SetupSubscription] Failed to store subscription ID:', storageError)
    }

    // Store security key (sensitive - in production, use secure storage)
    const { error: keyError } = await supabaseAdmin
      .from('system_config')
      .upsert({
        key: 'bill_subscription_security_key',
        value: subscriptionData.securityKey,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })

    if (keyError) {
      console.warn('[SetupSubscription] Failed to store security key:', keyError)
    }

    return NextResponse.json({
      success: true,
      message: 'Bill.com subscription created successfully',
      subscriptionId: subscriptionData.id,
      notificationUrl,
      eventsSubscribed: eventsToSubscribe.map(e => e.type),
    })

  } catch (error) {
    console.error('[SetupSubscription] Error:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: 'Failed to setup subscription', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to set up Bill.com webhooks',
    required: ['BILL_DEVELOPER_KEY', 'BILL_ORGANIZATION_ID', 'BILL_USERNAME', 'BILL_PASSWORD', 'NEXT_PUBLIC_APP_URL'],
  })
}

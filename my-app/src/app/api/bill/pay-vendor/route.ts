import { NextRequest, NextResponse } from 'next/server';
import { billClient } from '@/lib/billClient';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    // Get request data
    const { workOrderId } = await request.json();

    if (!workOrderId) {
      return NextResponse.json(
        { error: 'Work order ID is required' }, 
        { status: 400 }
      );
    }

    // Verify user authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' }, 
        { status: 401 }
      );
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.replace('Bearer ', '');
    
    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication token' }, 
        { status: 401 }
      );
    }

    // Check if user has permission (manager or admin only)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['manager', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only managers and admins can process payments.' }, 
        { status: 403 }
      );
    }

    // Verify work order exists and is completed
    const { data: workOrder } = await supabase
      .from('work_orders')
      .select('status, title, assigned_to')
      .eq('id', workOrderId)
      .single();

    if (!workOrder) {
      return NextResponse.json(
        { error: 'Work order not found' }, 
        { status: 404 }
      );
    }

    if (workOrder.status !== 'completed') {
      return NextResponse.json(
        { error: 'Can only pay for completed work orders' }, 
        { status: 400 }
      );
    }

    if (!workOrder.assigned_to) {
      return NextResponse.json(
        { error: 'No technician assigned to this work order' }, 
        { status: 400 }
      );
    }

    // Process vendor payment using Bill.com client
    await billClient.payVendorForWorkOrder(workOrderId);

    return NextResponse.json({ 
      success: true, 
      message: 'Vendor payment processed successfully',
      workOrderId: workOrderId,
      technician: workOrder.assigned_to
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to process vendor payment', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' }, 
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' }, 
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' }, 
    { status: 405 }
  );
}
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { CommitmentStatus } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH /api/finance-calls/[id] - Update a finance call record
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const callId = id.trim();

    if (!callId) {
      return NextResponse.json({ success: false, error: 'Finance Call ID is required.' }, { status: 400 });
    }

    const body = await request.json();
    const updatePayload: Record<string, unknown> = {};

    if (typeof body.person_name === 'string') {
      const name = body.person_name.trim();
      if (!name) {
        return NextResponse.json(
          { success: false, error: 'Contact name cannot be empty.' },
          { status: 400 }
        );
      }
      updatePayload.person_name = name;
    }

    if (body.mobile_number !== undefined) {
      updatePayload.mobile_number =
        typeof body.mobile_number === 'string' && body.mobile_number.trim().length > 0
          ? body.mobile_number.trim()
          : null;
    }

    if (body.caller_name !== undefined) {
      updatePayload.caller_name =
        typeof body.caller_name === 'string' && body.caller_name.trim().length > 0
          ? body.caller_name.trim()
          : null;
    }

    if (body.promised !== undefined) {
      const promised = Number(body.promised);
      if (isNaN(promised) || promised <= 0) {
        return NextResponse.json(
          { success: false, error: 'Promised amount must be greater than 0.' },
          { status: 400 }
        );
      }
      updatePayload.promised = promised;
    }

    if (body.received !== undefined) {
      const received = Number(body.received);
      if (isNaN(received) || received < 0) {
        return NextResponse.json(
          { success: false, error: 'Received amount must be 0 or greater.' },
          { status: 400 }
        );
      }
      updatePayload.received = received;
    }

    if (body.money_type !== undefined) {
      updatePayload.money_type =
        body.money_type === 'Cash' || body.money_type === 'UPI' ? body.money_type : null;
    }

    if (body.screenshot_link !== undefined) {
      updatePayload.screenshot_link =
        typeof body.screenshot_link === 'string' && body.screenshot_link.trim().length > 0
          ? body.screenshot_link.trim()
          : null;
    }

    if (body.notes !== undefined) {
      updatePayload.notes =
        typeof body.notes === 'string' && body.notes.trim().length > 0
          ? body.notes.trim()
          : null;
    }

    // Determine status update
    if (body.status && ['Pending', 'Partially Received', 'Fully Received', 'Cancelled'].includes(body.status)) {
      updatePayload.status = body.status as CommitmentStatus;
    } else if (updatePayload.promised !== undefined || updatePayload.received !== undefined) {
      const { data: current } = await supabase
        .from('finance_calls')
        .select('promised, received, status')
        .eq('id', callId)
        .single();

      if (current && current.status !== 'Cancelled') {
        const promisedVal = Number(updatePayload.promised ?? current.promised);
        const receivedVal = Number(updatePayload.received ?? current.received);

        if (receivedVal >= promisedVal) {
          updatePayload.status = 'Fully Received';
        } else if (receivedVal > 0) {
          updatePayload.status = 'Partially Received';
        } else {
          updatePayload.status = 'Pending';
        }
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields provided for update.' },
        { status: 400 }
      );
    }

    const { data: updatedCall, error: updateError } = await supabase
      .from('finance_calls')
      .update(updatePayload)
      .eq('id', callId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    if (!updatedCall) {
      return NextResponse.json(
        { success: false, error: 'Finance call record not found.' },
        { status: 404 }
      );
    }

    // Ensure income record reflects new received amount
    if (updatedCall.received > 0 && updatedCall.status !== 'Cancelled') {
      const { data: incRows } = await supabase
        .from('income')
        .select('amount')
        .or(`reference_id.eq.${callId},commitment_id.eq.${callId}`);

      const totalInc = (incRows ?? []).reduce((s, r) => s + Number(r.amount), 0);
      if (updatedCall.received > totalInc) {
        const diffAmt = updatedCall.received - totalInc;
        const { data: allIncIds } = await supabase.from('income').select('id');
        let maxIncNum = 0;
        if (allIncIds) {
          for (const item of allIncIds) {
            const m = item.id.match(/^INC-(\d+)$/i);
            if (m) {
              const n = parseInt(m[1], 10);
              if (n > maxIncNum) maxIncNum = n;
            }
          }
        }
        const incId = `INC-${String(maxIncNum + 1).padStart(4, '0')}`;
        const moneyType = (body.money_type === 'Cash' ? 'Cash' : updatedCall.money_type === 'Cash' ? 'Cash' : 'UPI');
        const incDate = typeof body.date === 'string' && body.date.trim() ? body.date.trim() : new Date().toISOString().split('T')[0];

        await supabase.from('income').insert({
          id: incId,
          date: incDate,
          type: 'Finance Call',
          contributor: updatedCall.person_name,
          mobile_number: updatedCall.mobile_number || null,
          description: `Payment against ${callId}`,
          amount: diffAmt,
          money_type: moneyType,
          screenshot_link: updatedCall.screenshot_link || null,
          notes: body.notes || `Payment update for ${callId}`,
          reference_id: callId,
          commitment_id: callId,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedCall,
      message: 'Finance call updated successfully.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/finance-calls/[id] - Delete a finance call record
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const callId = id.trim();

    if (!callId) {
      return NextResponse.json({ success: false, error: 'Finance Call ID is required.' }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from('finance_calls')
      .delete()
      .eq('id', callId);

    if (deleteError) {
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Finance call deleted successfully.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

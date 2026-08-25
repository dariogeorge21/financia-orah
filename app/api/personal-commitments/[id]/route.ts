import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { CommitmentStatus } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH /api/personal-commitments/[id] - Update a personal commitment
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const commitmentId = id.trim();

    if (!commitmentId) {
      return NextResponse.json({ success: false, error: 'Commitment ID is required.' }, { status: 400 });
    }

    const body = await request.json();
    const updatePayload: Record<string, unknown> = {};

    if (typeof body.person_name === 'string') {
      const name = body.person_name.trim();
      if (!name) {
        return NextResponse.json(
          { success: false, error: 'Person name cannot be empty.' },
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

    if (body.caller_name !== undefined) {
      updatePayload.caller_name =
        typeof body.caller_name === 'string' && body.caller_name.trim().length > 0
          ? body.caller_name.trim()
          : null;
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

    if (body.is_handed_over !== undefined) {
      updatePayload.is_handed_over = Boolean(body.is_handed_over);
    }

    if (body.notes !== undefined) {
      updatePayload.notes =
        typeof body.notes === 'string' && body.notes.trim().length > 0
          ? body.notes.trim()
          : null;
    }

    if (body.prayer_request !== undefined) {
      updatePayload.prayer_request =
        typeof body.prayer_request === 'string' && body.prayer_request.trim().length > 0
          ? body.prayer_request.trim()
          : null;
    }

    if (body.status && ['Pending', 'Partially Received', 'Fully Received', 'Cancelled'].includes(body.status)) {
      updatePayload.status = body.status as CommitmentStatus;
    }

    if (updatePayload.promised !== undefined || updatePayload.received !== undefined) {
      const { data: current } = await supabase
        .from('personal_commitments')
        .select('promised, received, status')
        .eq('id', commitmentId)
        .single();

      if (current) {
        const promisedVal = Number(updatePayload.promised ?? current.promised);
        const receivedVal = Number(updatePayload.received ?? current.received);

        if (receivedVal > promisedVal) {
          return NextResponse.json(
            { success: false, error: 'Received amount cannot exceed the promised amount.' },
            { status: 400 }
          );
        }

        if (!body.status && current.status !== 'Cancelled') {
          if (receivedVal >= promisedVal && promisedVal > 0) {
            updatePayload.status = 'Fully Received';
          } else if (receivedVal > 0) {
            updatePayload.status = 'Partially Received';
          } else {
            updatePayload.status = 'Pending';
          }
        }
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields provided for update.' },
        { status: 400 }
      );
    }

    const { data: updatedCommitment, error: updateError } = await supabase
      .from('personal_commitments')
      .update(updatePayload)
      .eq('id', commitmentId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    // Ensure income record reflects new received amount
    if (updatedCommitment.received > 0 && updatedCommitment.status !== 'Cancelled') {
      const { data: incRows } = await supabase
        .from('income')
        .select('amount')
        .or(`reference_id.eq.${commitmentId},commitment_id.eq.${commitmentId}`);

      const totalInc = (incRows ?? []).reduce((s, r) => s + Number(r.amount), 0);
      if (updatedCommitment.received > totalInc) {
        const diffAmt = updatedCommitment.received - totalInc;
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
        const moneyType = (body.money_type === 'Cash' ? 'Cash' : updatedCommitment.money_type === 'Cash' ? 'Cash' : 'UPI');
        const incDate = typeof body.date === 'string' && body.date.trim() ? body.date.trim() : new Date().toISOString().split('T')[0];
        const isHandedOver = moneyType === 'UPI' ? true : updatedCommitment.is_handed_over ?? false;

        await supabase.from('income').insert({
          id: incId,
          date: incDate,
          type: 'Personal Commitment',
          contributor: updatedCommitment.person_name,
          mobile_number: updatedCommitment.mobile_number || null,
          description: `Payment against ${commitmentId}`,
          amount: diffAmt,
          money_type: moneyType,
          is_handed_over: isHandedOver,
          screenshot_link: updatedCommitment.screenshot_link || null,
          notes: body.notes || `Payment update for ${commitmentId}`,
          reference_id: commitmentId,
          commitment_id: commitmentId,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedCommitment,
      message: 'Commitment updated successfully.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/personal-commitments/[id] - Delete a personal commitment
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const commitmentId = id.trim();

    if (!commitmentId) {
      return NextResponse.json({ success: false, error: 'Commitment ID is required.' }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from('personal_commitments')
      .delete()
      .eq('id', commitmentId);

    if (deleteError) {
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Personal commitment deleted successfully.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

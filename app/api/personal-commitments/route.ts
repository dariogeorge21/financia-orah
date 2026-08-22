import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { PersonalCommitmentRecord, CommitmentStatus } from '@/lib/types';

// GET /api/personal-commitments - Fetch all personal commitments and computed statistics
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('personal_commitments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const commitments = (data ?? []) as PersonalCommitmentRecord[];
    const active = commitments.filter((c) => c.status !== 'Cancelled');
    const totalPromised = active.reduce((s, c) => s + Number(c.promised), 0);
    const totalReceived = active.reduce((s, c) => s + Number(c.received), 0);
    const totalPending = Math.max(0, totalPromised - totalReceived);
    const fulfillmentPct = totalPromised > 0 ? Math.round((totalReceived / totalPromised) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: {
        commitments,
        summary: {
          totalPromised,
          totalReceived,
          totalPending,
          fulfillmentPct,
          totalCount: commitments.length,
          activeCount: active.length,
          fullyReceivedCount: active.filter((c) => c.status === 'Fully Received').length,
          partiallyReceivedCount: active.filter((c) => c.status === 'Partially Received').length,
          pendingCount: active.filter((c) => c.status === 'Pending').length,
          cancelledCount: commitments.filter((c) => c.status === 'Cancelled').length,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/personal-commitments - Create a new personal commitment
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const personName = typeof body.person_name === 'string' ? body.person_name.trim() : '';
    const mobileNumber = typeof body.mobile_number === 'string' ? body.mobile_number.trim() : null;
    const promised = Number(body.promised);
    const received = body.received !== undefined ? Number(body.received) : 0;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;

    if (!personName) {
      return NextResponse.json(
        { success: false, error: 'Person name is required.' },
        { status: 400 }
      );
    }

    if (isNaN(promised) || promised <= 0) {
      return NextResponse.json(
        { success: false, error: 'Promised amount must be greater than 0.' },
        { status: 400 }
      );
    }

    if (isNaN(received) || received < 0) {
      return NextResponse.json(
        { success: false, error: 'Received amount must be 0 or greater.' },
        { status: 400 }
      );
    }

    // Determine initial status
    let status: CommitmentStatus = 'Pending';
    if (body.status && ['Pending', 'Partially Received', 'Fully Received', 'Cancelled'].includes(body.status)) {
      status = body.status;
    } else if (received >= promised) {
      status = 'Fully Received';
    } else if (received > 0) {
      status = 'Partially Received';
    }

    // Generate next unique PCOM-XXXX id
    const { data: allIds } = await supabase
      .from('personal_commitments')
      .select('id');

    let maxNum = 0;
    if (allIds) {
      for (const item of allIds) {
        const match = item.id.match(/^PCOM-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }

    const nextId = `PCOM-${String(maxNum + 1).padStart(4, '0')}`;

    const { data: newCommitment, error: insertError } = await supabase
      .from('personal_commitments')
      .insert({
        id: nextId,
        person_name: personName,
        mobile_number: mobileNumber || null,
        promised,
        received,
        status,
        notes: notes || null,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    // Ensure income record exists if received > 0
    if (received > 0) {
      const { data: existingInc } = await supabase
        .from('income')
        .select('id')
        .or(`reference_id.eq.${nextId},commitment_id.eq.${nextId}`);

      if (!existingInc || existingInc.length === 0) {
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
        const moneyType = (body.money_type === 'Cash' ? 'Cash' : 'UPI');
        const incDate = typeof body.date === 'string' && body.date.trim() ? body.date.trim() : new Date().toISOString().split('T')[0];

        await supabase.from('income').insert({
          id: incId,
          date: incDate,
          type: 'Personal Commitment',
          contributor: personName,
          mobile_number: mobileNumber || null,
          description: `Payment against ${nextId}`,
          amount: received,
          money_type: moneyType,
          notes: notes || `Auto-recorded from ${nextId}`,
          reference_id: nextId,
          commitment_id: nextId,
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: newCommitment,
        message: 'Personal commitment created successfully.',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ChurchDonationRecord, MoneyType } from '@/lib/types';

// GET /api/church-donations - Fetch all church & convent donations and computed summary statistics
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('church_donations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const donations = (data ?? []) as ChurchDonationRecord[];

    const totalAmount = donations.reduce((s, d) => s + Number(d.amount), 0);
    const cashAmount = donations
      .filter((d) => d.money_type === 'Cash')
      .reduce((s, d) => s + Number(d.amount), 0);
    const upiAmount = donations
      .filter((d) => d.money_type === 'UPI')
      .reduce((s, d) => s + Number(d.amount), 0);

    return NextResponse.json({
      success: true,
      data: {
        donations,
        summary: {
          totalAmount,
          cashAmount,
          upiAmount,
          totalCount: donations.length,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/church-donations - Create a new church & convent donation record
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const churchName = typeof body.church_name === 'string' ? body.church_name.trim() : '';
    const contactNumber = typeof body.contact_number === 'string' ? body.contact_number.trim() : null;
    const date = typeof body.date === 'string' && body.date.trim() ? body.date.trim() : new Date().toISOString().split('T')[0];
    const moneyType = body.money_type as MoneyType;
    const amount = Number(body.amount);
    const collectedBy = typeof body.collected_by === 'string' ? body.collected_by.trim() : null;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;
    const screenshotLink = typeof body.screenshot_link === 'string' ? body.screenshot_link.trim() : null;

    if (!churchName) {
      return NextResponse.json({ success: false, error: 'Church / Convent name is required.' }, { status: 400 });
    }

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be greater than 0.' },
        { status: 400 }
      );
    }

    if (!moneyType || !['Cash', 'UPI'].includes(moneyType)) {
      return NextResponse.json(
        { success: false, error: 'Valid money type (Cash or UPI) is required.' },
        { status: 400 }
      );
    }

    // Generate next sequential CHU-XXXX id
    const { data: allIds } = await supabase.from('church_donations').select('id');

    let maxNum = 0;
    if (allIds) {
      for (const item of allIds) {
        const match = item.id.match(/^CHU-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }

    const nextId = `CHU-${String(maxNum + 1).padStart(4, '0')}`;

    const { data: newDonation, error: insertError } = await supabase
      .from('church_donations')
      .insert({
        id: nextId,
        church_name: churchName,
        contact_number: contactNumber || null,
        date,
        collected_by: collectedBy || null,
        money_type: moneyType,
        amount,
        notes: notes || null,
        screenshot_link: screenshotLink || null,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    // Fallback sync to income if trigger is not yet active
    const { data: existingIncome } = await supabase
      .from('income')
      .select('id')
      .or(`reference_id.eq.${nextId},commitment_id.eq.${nextId}`)
      .maybeSingle();

    if (!existingIncome) {
      // Find next INC id
      const { data: allIncIds } = await supabase.from('income').select('id');
      let maxIncNum = 0;
      if (allIncIds) {
        for (const item of allIncIds) {
          const match = item.id.match(/^INC-(\d+)$/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxIncNum) maxIncNum = num;
          }
        }
      }
      const nextIncId = `INC-${String(maxIncNum + 1).padStart(4, '0')}`;
      const combinedNotes = [notes, collectedBy ? `Volunteer: ${collectedBy}` : null]
        .filter(Boolean)
        .join(' | ');

      await supabase.from('income').insert({
        id: nextIncId,
        date,
        type: 'Church',
        contributor: churchName,
        mobile_number: contactNumber || null,
        description: 'Church & Convent Donation',
        amount,
        money_type: moneyType,
        screenshot_link: screenshotLink || null,
        notes: combinedNotes || null,
        reference_id: nextId,
        commitment_id: nextId,
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: newDonation,
        message: 'Church & Convent donation recorded and synced to income successfully.',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

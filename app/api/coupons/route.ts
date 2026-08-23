import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { CouponRecord, MoneyType } from '@/lib/types';

// GET /api/coupons - Fetch all coupon records and computed summary statistics
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const coupons = (data ?? []) as CouponRecord[];

    const totalAmount = coupons.reduce((s, c) => s + Number(c.amount), 0);
    const cashAmount = coupons
      .filter((c) => c.money_type === 'Cash')
      .reduce((s, c) => s + Number(c.amount), 0);
    const upiAmount = coupons
      .filter((c) => c.money_type === 'UPI')
      .reduce((s, c) => s + Number(c.amount), 0);

    return NextResponse.json({
      success: true,
      data: {
        coupons,
        summary: {
          totalAmount,
          cashAmount,
          upiAmount,
          totalCount: coupons.length,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/coupons - Create a new coupon record
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const contributorName = typeof body.contributor_name === 'string' ? body.contributor_name.trim() : '';
    const mobileNumber = typeof body.mobile_number === 'string' ? body.mobile_number.trim() : null;
    const date = typeof body.date === 'string' && body.date.trim() ? body.date.trim() : new Date().toISOString().split('T')[0];
    const moneyType = body.money_type as MoneyType;
    const amount = Number(body.amount);
    const collectedBy = typeof body.collected_by === 'string' ? body.collected_by.trim() : null;
    const bookletNumber = typeof body.booklet_number === 'string' ? body.booklet_number.trim() : null;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;
    const screenshotLink = typeof body.screenshot_link === 'string' ? body.screenshot_link.trim() : null;

    if (!contributorName) {
      return NextResponse.json({ success: false, error: 'Contributor name is required.' }, { status: 400 });
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

    // Generate next sequential CPN-XXXX id
    const { data: allIds } = await supabase.from('coupons').select('id');

    let maxNum = 0;
    if (allIds) {
      for (const item of allIds) {
        const match = item.id.match(/^CPN-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }

    const nextId = `CPN-${String(maxNum + 1).padStart(4, '0')}`;

    const { data: newCoupon, error: insertError } = await supabase
      .from('coupons')
      .insert({
        id: nextId,
        contributor_name: contributorName,
        mobile_number: mobileNumber || null,
        date,
        money_type: moneyType,
        amount,
        collected_by: collectedBy || null,
        booklet_number: bookletNumber || null,
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
      const desc = `Coupon Collection${bookletNumber ? ` (Booklet #${bookletNumber})` : ''}`;
      const combinedNotes = [notes, collectedBy ? `Volunteer: ${collectedBy}` : null]
        .filter(Boolean)
        .join(' | ');

      await supabase.from('income').insert({
        id: nextIncId,
        date,
        type: 'Coupon',
        contributor: contributorName,
        mobile_number: mobileNumber || null,
        description: desc,
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
        data: newCoupon,
        message: 'Coupon recorded and synced to income successfully.',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

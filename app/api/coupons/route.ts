import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { CouponRecord, CouponPaymentMode } from '@/lib/types';
import { extractDateKey, getTodayDateString, calcCouponSummary } from '@/lib/calculations';

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
    const summary = calcCouponSummary(coupons);

    return NextResponse.json({
      success: true,
      data: {
        coupons,
        summary: {
          totalAmount: summary.totalAmount,
          cashAmount: summary.cashAmount,
          upiAmount: summary.upiAmount,
          totalCount: summary.count,
          splitCount: summary.splitCount,
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
    const date = typeof body.date === 'string' && body.date.trim() ? extractDateKey(body.date) : getTodayDateString();
    const moneyType = body.money_type as CouponPaymentMode;
    let amount = Number(body.amount);
    const collectedBy = typeof body.collected_by === 'string' ? body.collected_by.trim() : null;
    const bookletNumber = typeof body.booklet_number === 'string' ? body.booklet_number.trim() : null;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;
    const screenshotLink = typeof body.screenshot_link === 'string' ? body.screenshot_link.trim() : null;

    if (!contributorName) {
      return NextResponse.json({ success: false, error: 'Contributor name is required.' }, { status: 400 });
    }

    if (!moneyType || !['Cash', 'UPI', 'Cash + UPI'].includes(moneyType)) {
      return NextResponse.json(
        { success: false, error: 'Valid money type (Cash, UPI, or Cash + UPI) is required.' },
        { status: 400 }
      );
    }

    let cashAmount: number | null = null;
    let upiAmount: number | null = null;

    if (moneyType === 'Cash + UPI') {
      cashAmount = Number(body.cash_amount);
      upiAmount = Number(body.upi_amount);

      if (isNaN(cashAmount) || cashAmount <= 0) {
        return NextResponse.json(
          { success: false, error: 'Cash amount must be greater than 0 for split payment.' },
          { status: 400 }
        );
      }

      if (isNaN(upiAmount) || upiAmount <= 0) {
        return NextResponse.json(
          { success: false, error: 'UPI amount must be greater than 0 for split payment.' },
          { status: 400 }
        );
      }

      // Auto compute or verify total amount
      amount = cashAmount + upiAmount;
    } else {
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json(
          { success: false, error: 'Amount must be greater than 0.' },
          { status: 400 }
        );
      }
      if (moneyType === 'Cash') {
        cashAmount = amount;
        upiAmount = 0;
      } else {
        cashAmount = 0;
        upiAmount = amount;
      }
    }

    const isHandedOver = moneyType === 'UPI' ? true : body.is_handed_over !== undefined ? Boolean(body.is_handed_over) : false;

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
    const prayerRequest = typeof body.prayer_request === 'string' ? body.prayer_request.trim() : null;

    // Build coupon insert payload
    const couponPayload: Record<string, unknown> = {
      id: nextId,
      contributor_name: contributorName,
      mobile_number: mobileNumber || null,
      date,
      money_type: moneyType,
      amount,
      is_handed_over: isHandedOver,
      collected_by: collectedBy || null,
      booklet_number: bookletNumber || null,
      notes: notes || null,
      prayer_request: prayerRequest || null,
      screenshot_link: screenshotLink || null,
    };

    if (cashAmount !== null) couponPayload.cash_amount = cashAmount;
    if (upiAmount !== null) couponPayload.upi_amount = upiAmount;

    let { data: newCoupon, error: insertError } = await supabase
      .from('coupons')
      .insert(couponPayload)
      .select()
      .single();

    // If schema extension is missing column, retry without cash_amount/upi_amount
    if (insertError && insertError.code === '42703') {
      delete couponPayload.cash_amount;
      delete couponPayload.upi_amount;
      const retry = await supabase.from('coupons').insert(couponPayload).select().single();
      newCoupon = retry.data;
      insertError = retry.error;
    }

    if (insertError) {
      if (insertError.code === '23514') {
        return NextResponse.json({
          success: false,
          error: "Database constraint needs updating. Please run migration 'supabase/migrations/20260908000000_add_cash_plus_upi_to_coupons.sql' in Supabase SQL editor to enable Cash + UPI mode.",
        }, { status: 400 });
      }
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    // Fallback sync to income if DB trigger is not active
    const desc = `Coupon Collection${bookletNumber ? ` (Booklet #${bookletNumber})` : ''}`;
    const combinedNotes = [notes, collectedBy ? `Volunteer: ${collectedBy}` : null]
      .filter(Boolean)
      .join(' | ');

    if (moneyType === 'Cash + UPI') {
      // Check if cash & upi income records exist
      const { data: existingIncome } = await supabase
        .from('income')
        .select('id')
        .in('reference_id', [`${nextId}-CASH`, `${nextId}-UPI`]);

      if (!existingIncome || existingIncome.length === 0) {
        // Find next INC id counter
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

        const nextIncCashId = `INC-${String(maxIncNum + 1).padStart(4, '0')}`;
        const nextIncUpiId = `INC-${String(maxIncNum + 2).padStart(4, '0')}`;

        // Insert Cash portion
        if (cashAmount && cashAmount > 0) {
          await supabase.from('income').insert({
            id: nextIncCashId,
            date,
            type: 'Coupon',
            contributor: contributorName,
            mobile_number: mobileNumber || null,
            description: `${desc} (Cash)`,
            amount: cashAmount,
            money_type: 'Cash',
            is_handed_over: isHandedOver,
            screenshot_link: null,
            notes: [combinedNotes, 'Split: Cash portion'].filter(Boolean).join(' | '),
            prayer_request: prayerRequest || null,
            reference_id: `${nextId}-CASH`,
            commitment_id: nextId,
          });
        }

        // Insert UPI portion
        if (upiAmount && upiAmount > 0) {
          await supabase.from('income').insert({
            id: nextIncUpiId,
            date,
            type: 'Coupon',
            contributor: contributorName,
            mobile_number: mobileNumber || null,
            description: `${desc} (UPI)`,
            amount: upiAmount,
            money_type: 'UPI',
            is_handed_over: true,
            screenshot_link: screenshotLink || null,
            notes: [combinedNotes, 'Split: UPI portion'].filter(Boolean).join(' | '),
            prayer_request: prayerRequest || null,
            reference_id: `${nextId}-UPI`,
            commitment_id: nextId,
          });
        }
      }
    } else {
      // Standard single mode fallback
      const { data: existingIncome } = await supabase
        .from('income')
        .select('id')
        .or(`reference_id.eq.${nextId},commitment_id.eq.${nextId}`)
        .maybeSingle();

      if (!existingIncome) {
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

        await supabase.from('income').insert({
          id: nextIncId,
          date,
          type: 'Coupon',
          contributor: contributorName,
          mobile_number: mobileNumber || null,
          description: desc,
          amount,
          money_type: moneyType,
          is_handed_over: isHandedOver,
          screenshot_link: screenshotLink || null,
          notes: combinedNotes || null,
          prayer_request: prayerRequest || null,
          reference_id: nextId,
          commitment_id: nextId,
        });
      }
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

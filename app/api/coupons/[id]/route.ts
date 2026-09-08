import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { CouponRecord, CouponPaymentMode } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/coupons/[id] - Fetch single coupon
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: 'Coupon record not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: data as CouponRecord });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PATCH /api/coupons/[id] - Update coupon record
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updates: Partial<CouponRecord> = {};

    if (body.contributor_name !== undefined) updates.contributor_name = body.contributor_name.trim();
    if (body.mobile_number !== undefined) updates.mobile_number = body.mobile_number ? body.mobile_number.trim() : null;
    if (body.date !== undefined) updates.date = body.date.trim();
    if (body.money_type !== undefined) updates.money_type = body.money_type as CouponPaymentMode;
    if (body.amount !== undefined) updates.amount = Number(body.amount);
    if (body.cash_amount !== undefined) updates.cash_amount = body.cash_amount !== null ? Number(body.cash_amount) : null;
    if (body.upi_amount !== undefined) updates.upi_amount = body.upi_amount !== null ? Number(body.upi_amount) : null;
    if (body.collected_by !== undefined) updates.collected_by = body.collected_by ? body.collected_by.trim() : null;
    if (body.booklet_number !== undefined) updates.booklet_number = body.booklet_number ? body.booklet_number.trim() : null;
    if (body.notes !== undefined) updates.notes = body.notes ? body.notes.trim() : null;
    if (body.prayer_request !== undefined) updates.prayer_request = body.prayer_request ? body.prayer_request.trim() : null;
    if (body.screenshot_link !== undefined) updates.screenshot_link = body.screenshot_link ? body.screenshot_link.trim() : null;
    if (body.is_handed_over !== undefined) updates.is_handed_over = Boolean(body.is_handed_over);

    if (updates.money_type === 'Cash + UPI') {
      const cAmt = updates.cash_amount !== undefined ? updates.cash_amount : 0;
      const uAmt = updates.upi_amount !== undefined ? updates.upi_amount : 0;
      if (cAmt !== null && uAmt !== null && cAmt + uAmt > 0) {
        updates.amount = cAmt + uAmt;
      }
    }

    if (updates.amount !== undefined && (isNaN(updates.amount) || updates.amount <= 0)) {
      return NextResponse.json({ success: false, error: 'Amount must be greater than 0.' }, { status: 400 });
    }

    let { data: updatedCoupon, error } = await supabase
      .from('coupons')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    // If column doesn't exist yet on DB, retry without cash_amount/upi_amount
    if (error && error.code === '42703') {
      delete updates.cash_amount;
      delete updates.upi_amount;
      const retry = await supabase.from('coupons').update(updates).eq('id', id).select().single();
      updatedCoupon = retry.data;
      error = retry.error;
    }

    if (error) {
      if (error.code === '23514') {
        return NextResponse.json({
          success: false,
          error: "Database constraint needs updating. Please run migration 'supabase/migrations/20260908000000_add_cash_plus_upi_to_coupons.sql' in Supabase SQL editor.",
        }, { status: 400 });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Also update corresponding income records if trigger is not active
    const { data: currentCoupon } = await supabase
      .from('coupons')
      .select('*')
      .eq('id', id)
      .single();

    if (currentCoupon) {
      const desc = `Coupon Collection${currentCoupon.booklet_number ? ` (Booklet #${currentCoupon.booklet_number})` : ''}`;
      const combinedNotes = [currentCoupon.notes, currentCoupon.collected_by ? `Volunteer: ${currentCoupon.collected_by}` : null]
        .filter(Boolean)
        .join(' | ');

      if (currentCoupon.money_type === 'Cash + UPI') {
        // Clean up legacy single record
        await supabase.from('income').delete().eq('reference_id', id);

        const cAmt = Number(currentCoupon.cash_amount || 0);
        const uAmt = Number(currentCoupon.upi_amount || 0);

        // Update or insert Cash portion
        const { data: cashInc } = await supabase.from('income').select('id').eq('reference_id', `${id}-CASH`).maybeSingle();
        if (cashInc) {
          await supabase.from('income').update({
            date: currentCoupon.date,
            contributor: currentCoupon.contributor_name,
            mobile_number: currentCoupon.mobile_number || null,
            description: `${desc} (Cash)`,
            amount: cAmt,
            money_type: 'Cash',
            is_handed_over: currentCoupon.is_handed_over,
            notes: [combinedNotes, 'Split: Cash portion'].filter(Boolean).join(' | '),
            prayer_request: currentCoupon.prayer_request || null,
          }).eq('id', cashInc.id);
        } else if (cAmt > 0) {
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
          await supabase.from('income').insert({
            id: nextIncCashId,
            date: currentCoupon.date,
            type: 'Coupon',
            contributor: currentCoupon.contributor_name,
            mobile_number: currentCoupon.mobile_number || null,
            description: `${desc} (Cash)`,
            amount: cAmt,
            money_type: 'Cash',
            is_handed_over: currentCoupon.is_handed_over,
            screenshot_link: null,
            notes: [combinedNotes, 'Split: Cash portion'].filter(Boolean).join(' | '),
            prayer_request: currentCoupon.prayer_request || null,
            reference_id: `${id}-CASH`,
            commitment_id: id,
          });
        }

        // Update or insert UPI portion
        const { data: upiInc } = await supabase.from('income').select('id').eq('reference_id', `${id}-UPI`).maybeSingle();
        if (upiInc) {
          await supabase.from('income').update({
            date: currentCoupon.date,
            contributor: currentCoupon.contributor_name,
            mobile_number: currentCoupon.mobile_number || null,
            description: `${desc} (UPI)`,
            amount: uAmt,
            money_type: 'UPI',
            is_handed_over: true,
            screenshot_link: currentCoupon.screenshot_link || null,
            notes: [combinedNotes, 'Split: UPI portion'].filter(Boolean).join(' | '),
            prayer_request: currentCoupon.prayer_request || null,
          }).eq('id', upiInc.id);
        } else if (uAmt > 0) {
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
          const nextIncUpiId = `INC-${String(maxIncNum + 2).padStart(4, '0')}`;
          await supabase.from('income').insert({
            id: nextIncUpiId,
            date: currentCoupon.date,
            type: 'Coupon',
            contributor: currentCoupon.contributor_name,
            mobile_number: currentCoupon.mobile_number || null,
            description: `${desc} (UPI)`,
            amount: uAmt,
            money_type: 'UPI',
            is_handed_over: true,
            screenshot_link: currentCoupon.screenshot_link || null,
            notes: [combinedNotes, 'Split: UPI portion'].filter(Boolean).join(' | '),
            prayer_request: currentCoupon.prayer_request || null,
            reference_id: `${id}-UPI`,
            commitment_id: id,
          });
        }
      } else {
        // Clean up any split records
        await supabase.from('income').delete().in('reference_id', [`${id}-CASH`, `${id}-UPI`]);

        // Upsert single record
        const { data: singleInc } = await supabase.from('income').select('id').eq('reference_id', id).maybeSingle();
        if (singleInc) {
          await supabase.from('income').update({
            date: currentCoupon.date,
            contributor: currentCoupon.contributor_name,
            mobile_number: currentCoupon.mobile_number || null,
            description: desc,
            amount: currentCoupon.amount,
            money_type: currentCoupon.money_type,
            is_handed_over: currentCoupon.money_type === 'UPI' ? true : currentCoupon.is_handed_over,
            screenshot_link: currentCoupon.screenshot_link || null,
            notes: combinedNotes || null,
            prayer_request: currentCoupon.prayer_request || null,
          }).eq('id', singleInc.id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedCoupon,
      message: 'Coupon updated successfully.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/coupons/[id] - Delete coupon record
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Delete associated income record (including split portions)
    await supabase
      .from('income')
      .delete()
      .or(`reference_id.eq.${id},reference_id.eq.${id}-CASH,reference_id.eq.${id}-UPI,commitment_id.eq.${id}`);

    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Coupon and associated income deleted successfully.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

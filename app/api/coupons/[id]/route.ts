import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { CouponRecord, MoneyType } from '@/lib/types';

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
    if (body.money_type !== undefined) updates.money_type = body.money_type as MoneyType;
    if (body.amount !== undefined) updates.amount = Number(body.amount);
    if (body.collected_by !== undefined) updates.collected_by = body.collected_by ? body.collected_by.trim() : null;
    if (body.booklet_number !== undefined) updates.booklet_number = body.booklet_number ? body.booklet_number.trim() : null;
    if (body.notes !== undefined) updates.notes = body.notes ? body.notes.trim() : null;
    if (body.screenshot_link !== undefined) updates.screenshot_link = body.screenshot_link ? body.screenshot_link.trim() : null;
    if (body.is_handed_over !== undefined) updates.is_handed_over = Boolean(body.is_handed_over);

    if (updates.amount !== undefined && (isNaN(updates.amount) || updates.amount <= 0)) {
      return NextResponse.json({ success: false, error: 'Amount must be greater than 0.' }, { status: 400 });
    }

    const { data: updatedCoupon, error } = await supabase
      .from('coupons')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Also update corresponding income record if fallback is needed
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

      await supabase
        .from('income')
        .update({
          date: currentCoupon.date,
          contributor: currentCoupon.contributor_name,
          mobile_number: currentCoupon.mobile_number || null,
          description: desc,
          amount: currentCoupon.amount,
          money_type: currentCoupon.money_type,
          is_handed_over: currentCoupon.money_type === 'UPI' ? true : currentCoupon.is_handed_over,
          screenshot_link: currentCoupon.screenshot_link || null,
          notes: combinedNotes || null,
        })
        .or(`reference_id.eq.${id},commitment_id.eq.${id}`);
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

    // Delete associated income record
    await supabase
      .from('income')
      .delete()
      .or(`reference_id.eq.${id},commitment_id.eq.${id}`);

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

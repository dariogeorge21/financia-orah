import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { IncomeRecord, IncomeType, MoneyType } from '@/lib/types';
import { extractDateKey, getTodayDateString } from '@/lib/calculations';

// GET /api/income - Fetch all income records and computed summary statistics
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('income')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const income = (data ?? []) as IncomeRecord[];

    const totalIncome = income.reduce((s, i) => s + Number(i.amount), 0);
    const cashTotal = income
      .filter((i) => i.money_type === 'Cash')
      .reduce((s, i) => s + Number(i.amount), 0);
    const cashHandedOverTotal = income
      .filter((i) => i.money_type === 'Cash' && i.is_handed_over !== false)
      .reduce((s, i) => s + Number(i.amount), 0);
    const cashPendingTotal = income
      .filter((i) => i.money_type === 'Cash' && i.is_handed_over === false)
      .reduce((s, i) => s + Number(i.amount), 0);
    const upiTotal = income
      .filter((i) => i.money_type === 'UPI')
      .reduce((s, i) => s + Number(i.amount), 0);

    return NextResponse.json({
      success: true,
      data: {
        income,
        summary: {
          totalIncome,
          cashTotal,
          cashHandedOverTotal,
          cashPendingTotal,
          upiTotal,
          totalCount: income.length,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/income - Create a new income record
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const date = typeof body.date === 'string' && body.date.trim() ? extractDateKey(body.date) : getTodayDateString();
    const type = body.type as IncomeType;
    const contributor = typeof body.contributor === 'string' ? body.contributor.trim() : '';
    const mobileNumber = typeof body.mobile_number === 'string' ? body.mobile_number.trim() : null;
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const amount = Number(body.amount);
    const moneyType = body.money_type as MoneyType;
    const isHandedOver = moneyType === 'UPI' ? true : body.is_handed_over !== undefined ? Boolean(body.is_handed_over) : true;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;
    const prayerRequest = typeof body.prayer_request === 'string' ? body.prayer_request.trim() : null;
    const referenceId = typeof body.reference_id === 'string' ? body.reference_id.trim() : null;

    if (!type) {
      return NextResponse.json({ success: false, error: 'Income type is required.' }, { status: 400 });
    }

    if (!contributor) {
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

    // Generate next sequential INC-XXXX id
    const { data: allIds } = await supabase.from('income').select('id');

    let maxNum = 0;
    if (allIds) {
      for (const item of allIds) {
        const match = item.id.match(/^INC-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }

    const nextId = `INC-${String(maxNum + 1).padStart(4, '0')}`;

    const screenshotLink = typeof body.screenshot_link === 'string' ? body.screenshot_link.trim() : null;

    const { data: newIncome, error: insertError } = await supabase
      .from('income')
      .insert({
        id: nextId,
        date,
        type,
        contributor,
        mobile_number: mobileNumber || null,
        description,
        amount,
        money_type: moneyType,
        is_handed_over: isHandedOver,
        screenshot_link: screenshotLink || null,
        notes: notes || null,
        prayer_request: prayerRequest || null,
        reference_id: referenceId || null,
        commitment_id: referenceId || null,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    // Safety fallback: if database trigger is not yet active and reference_id was not set
    if (!newIncome.reference_id) {
      if (type === 'Finance Call') {
        const { data: allCalls } = await supabase.from('finance_calls').select('id');
        let maxFc = 0;
        if (allCalls) {
          for (const item of allCalls) {
            const m = item.id.match(/^FC-(\d+)$/i);
            if (m) {
              const n = parseInt(m[1], 10);
              if (n > maxFc) maxFc = n;
            }
          }
        }
        const fcId = `FC-${String(maxFc + 1).padStart(4, '0')}`;
        await supabase.from('finance_calls').insert({
          id: fcId,
          person_name: contributor,
          mobile_number: mobileNumber || null,
          promised: amount,
          received: amount,
          status: 'Fully Received',
          money_type: moneyType,
          is_handed_over: isHandedOver,
          screenshot_link: screenshotLink || null,
          notes: notes || null,
          prayer_request: prayerRequest || null,
        });
        await supabase.from('income').update({ reference_id: fcId, commitment_id: fcId }).eq('id', nextId);
        newIncome.reference_id = fcId;
        newIncome.commitment_id = fcId;
      } else if (type === 'Personal Commitment' || type === 'Commitment') {
        const { data: allPcom } = await supabase.from('personal_commitments').select('id');
        let maxPcom = 0;
        if (allPcom) {
          for (const item of allPcom) {
            const m = item.id.match(/^PCOM-(\d+)$/i);
            if (m) {
              const n = parseInt(m[1], 10);
              if (n > maxPcom) maxPcom = n;
            }
          }
        }
        const pcomId = `PCOM-${String(maxPcom + 1).padStart(4, '0')}`;
        await supabase.from('personal_commitments').insert({
          id: pcomId,
          person_name: contributor,
          mobile_number: mobileNumber || null,
          promised: amount,
          received: amount,
          status: 'Fully Received',
          money_type: moneyType,
          is_handed_over: isHandedOver,
          screenshot_link: screenshotLink || null,
          notes: notes || null,
          prayer_request: prayerRequest || null,
        });
        await supabase.from('income').update({ reference_id: pcomId, commitment_id: pcomId }).eq('id', nextId);
        newIncome.reference_id = pcomId;
        newIncome.commitment_id = pcomId;
      } else if (type === 'Coupon') {
        const { data: allCpns } = await supabase.from('coupons').select('id');
        let maxCpn = 0;
        if (allCpns) {
          for (const item of allCpns) {
            const m = item.id.match(/^CPN-(\d+)$/i);
            if (m) {
              const n = parseInt(m[1], 10);
              if (n > maxCpn) maxCpn = n;
            }
          }
        }
        const cpnId = `CPN-${String(maxCpn + 1).padStart(4, '0')}`;
        await supabase.from('coupons').insert({
          id: cpnId,
          contributor_name: contributor,
          mobile_number: mobileNumber || null,
          date,
          money_type: moneyType,
          amount,
          is_handed_over: isHandedOver,
          notes: notes || null,
          prayer_request: prayerRequest || null,
          screenshot_link: screenshotLink || null,
        });
        await supabase.from('income').update({ reference_id: cpnId, commitment_id: cpnId }).eq('id', nextId);
        newIncome.reference_id = cpnId;
        newIncome.commitment_id = cpnId;
      } else if (type === 'Church' || type === 'Church/Convent') {
        const { data: allChus } = await supabase.from('church_donations').select('id');
        let maxChu = 0;
        if (allChus) {
          for (const item of allChus) {
            const m = item.id.match(/^CHU-(\d+)$/i);
            if (m) {
              const n = parseInt(m[1], 10);
              if (n > maxChu) maxChu = n;
            }
          }
        }
        const chuId = `CHU-${String(maxChu + 1).padStart(4, '0')}`;
        await supabase.from('church_donations').insert({
          id: chuId,
          church_name: contributor,
          contact_number: mobileNumber || null,
          date,
          money_type: moneyType,
          amount,
          is_handed_over: isHandedOver,
          notes: notes || null,
          prayer_request: prayerRequest || null,
          screenshot_link: screenshotLink || null,
        });
        await supabase.from('income').update({ reference_id: chuId, commitment_id: chuId }).eq('id', nextId);
        newIncome.reference_id = chuId;
        newIncome.commitment_id = chuId;
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: newIncome,
        message: 'Income record created successfully.',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

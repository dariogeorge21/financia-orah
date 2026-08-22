import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH /api/budget/[id] - Update a budget category
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const budgetId = parseInt(id, 10);

    if (isNaN(budgetId)) {
      return NextResponse.json({ success: false, error: 'Invalid budget ID.' }, { status: 400 });
    }

    const body = await request.json();
    const updatePayload: Record<string, unknown> = {};

    if (typeof body.category === 'string') {
      const trimmedCategory = body.category.trim();
      if (!trimmedCategory) {
        return NextResponse.json(
          { success: false, error: 'Category name cannot be empty.' },
          { status: 400 }
        );
      }

      // Check if duplicate category exists under a different ID
      const { data: duplicate } = await supabase
        .from('budget')
        .select('id')
        .ilike('category', trimmedCategory)
        .neq('id', budgetId)
        .maybeSingle();

      if (duplicate) {
        return NextResponse.json(
          { success: false, error: `Another category named "${trimmedCategory}" already exists.` },
          { status: 409 }
        );
      }

      updatePayload.category = trimmedCategory;
    }

    if (body.planned !== undefined) {
      const planned = Number(body.planned);
      if (isNaN(planned) || planned < 0) {
        return NextResponse.json(
          { success: false, error: 'Planned amount must be a positive number or zero.' },
          { status: 400 }
        );
      }
      updatePayload.planned = planned;
    }

    if (body.description !== undefined) {
      updatePayload.description =
        typeof body.description === 'string' && body.description.trim().length > 0
          ? body.description.trim()
          : null;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields provided for update.' },
        { status: 400 }
      );
    }

    const { data: updatedBudget, error: updateError } = await supabase
      .from('budget')
      .update(updatePayload)
      .eq('id', budgetId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    if (!updatedBudget) {
      return NextResponse.json(
        { success: false, error: 'Budget item not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedBudget,
      message: 'Budget updated successfully.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/budget/[id] - Delete a budget category
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const budgetId = parseInt(id, 10);

    if (isNaN(budgetId)) {
      return NextResponse.json({ success: false, error: 'Invalid budget ID.' }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from('budget')
      .delete()
      .eq('id', budgetId);

    if (deleteError) {
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Budget category deleted successfully.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

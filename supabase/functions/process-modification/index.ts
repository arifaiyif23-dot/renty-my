import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceRateLimit, RateLimitError } from "../_shared/ratelimit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') || 'https://renty.my',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { modificationId, action } = await req.json(); // action: 'approve' or 'reject'

    console.log('Processing modification:', { modificationId, action });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Unauthorized: No authorization header');
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Unauthorized: Invalid user token');
    }

    // Check suspension
    const { error: suspendError } = await supabase.rpc('check_user_not_suspended', {
      p_user_id: user.id
    });
    if (suspendError) {
      throw new Error('Your account has been suspended. Contact support for assistance.');
    }

    await enforceRateLimit(supabase, {
      userId: user.id,
      action: 'process-modification',
      maxAttempts: 60,
      windowMinutes: 10,
    });

    // Get modification with rental info
    const { data: modification, error: modError } = await supabase
      .from('rental_modifications')
      .select('*, rental:rentals!rental_id(*)')
      .eq('id', modificationId)
      .single();

    if (modError || !modification) {
      console.error('Modification fetch error:', modError);
      throw new Error('Modification request not found');
    }

    console.log('Modification found:', { id: modification.id, rentalId: modification.rental_id, status: modification.status });

    // Verify caller is the owner
    if (modification.rental.owner_id !== user.id) {
      throw new Error('Unauthorized: Only the owner can respond to modification requests');
    }

    // Verify modification is pending
    if (modification.status !== 'pending') {
      throw new Error(`Modification already ${modification.status}`);
    }

    // Verify rental is active
    if (modification.rental.status !== 'active') {
      throw new Error(`Cannot modify rental in '${modification.rental.status}' status`);
    }

    if (action === 'approve') {
      // Check overlap for extension
      if (modification.type === 'extension' && modification.new_end_date > modification.rental.end_date) {
        const { count: overlapCount, error: overlapError } = await supabase
          .from('rentals')
          .select('*', { count: 'exact', head: true })
          .eq('item_id', modification.rental.item_id)
          .in('status', ['payment_pending', 'reserved', 'confirmed', 'active', 'overdue'])
          .neq('id', modification.rental_id)
          .lte('start_date', modification.new_end_date)
          .gte('end_date', modification.rental.end_date);

        if (overlapError) {
          console.error('Overlap check error:', overlapError);
          throw new Error('Failed to verify availability');
        }
        if ((overlapCount ?? 0) > 0) {
          throw new Error('The item is no longer available for the extended dates');
        }
      }

      // Server-side price recomputation: never trust the client's
      // price_adjustment. The delta is item.price_per_day x number of days
      // changed (positive = extension, negative = early return).
      const { data: itemPrice, error: itemPriceError } = await supabase
        .from('items')
        .select('price_per_day')
        .eq('id', modification.rental.item_id)
        .single();

      if (itemPriceError || !itemPrice) {
        throw new Error('Failed to verify item pricing');
      }

      const baseDate = new Date(`${modification.rental.end_date}T00:00:00`);
      const targetDate = new Date(`${modification.new_end_date}T00:00:00`);
      const deltaDays = Math.round((targetDate.getTime() - baseDate.getTime()) / 86400000);
      const expectedAdjustment = Math.round(deltaDays * Number(itemPrice.price_per_day || 0) * 100) / 100;

      if (Math.abs(expectedAdjustment - Number(modification.price_adjustment || 0)) > 0.01) {
        throw new Error(`Price adjustment mismatch. Expected RM${expectedAdjustment.toFixed(2)} for a ${Math.abs(deltaDays)}-day change.`);
      }

      // Update modification status
      const { error: updateModError } = await supabase
        .from('rental_modifications')
        .update({
          status: 'approved',
          responded_at: new Date().toISOString(),
          responded_by: user.id,
        })
        .eq('id', modificationId)
        .eq('status', 'pending');

      if (updateModError) {
        console.error('Modification update error:', updateModError);
        throw updateModError;
      }

      // Update rental end_date and total_price using the SERVER-computed delta.
      const newTotalPrice = Math.max(0, Number(modification.rental.total_price) + expectedAdjustment);
      const { error: updateRentalError } = await supabase
        .from('rentals')
        .update({
          end_date: modification.new_end_date,
          total_price: Math.round(newTotalPrice * 100) / 100,
        })
        .eq('id', modification.rental_id);

      if (updateRentalError) {
        console.error('Rental update error:', updateRentalError);
        throw updateRentalError;
      }

      // Log the approval
      await supabase.from('payment_flow_logs').insert({
        rental_id: modification.rental_id,
        stage: `modification_${modification.type}_approved`,
        status: 'success',
        details: {
          modificationId,
          type: modification.type,
          originalEndDate: modification.original_end_date,
          newEndDate: modification.new_end_date,
          priceAdjustment: modification.price_adjustment,
          timestamp: new Date().toISOString(),
        }
      });

      // Notify renter
      const typeLabel = modification.type === 'extension' ? 'extension' : 'early return';
      await supabase.from('notifications').insert({
        user_id: modification.rental.renter_id,
        type: 'rental_approved',
        title: `${typeLabel === 'extension' ? 'Extension' : 'Early Return'} Request Approved`,
        message: modification.type === 'extension'
          ? `Your rental extension request has been approved! Your rental is now extended to ${new Date(modification.new_end_date).toLocaleDateString()}.`
          : `Your early return request has been approved. Please return the item by ${new Date(modification.new_end_date).toLocaleDateString()}.`,
        link: '/dashboard',
      });
    } else {
      // Reject — just update modification status
      const { error: updateModError } = await supabase
        .from('rental_modifications')
        .update({
          status: 'rejected',
          responded_at: new Date().toISOString(),
          responded_by: user.id,
        })
        .eq('id', modificationId)
        .eq('status', 'pending');

      if (updateModError) {
        console.error('Modification update error:', updateModError);
        throw updateModError;
      }

      // Notify renter
      const typeLabel = modification.type === 'extension' ? 'extension' : 'early return';
      await supabase.from('notifications').insert({
        user_id: modification.rental.renter_id,
        type: 'rental_rejected',
        title: `${typeLabel === 'extension' ? 'Extension' : 'Early Return'} Request Declined`,
        message: `Your ${typeLabel} request has been declined by the owner.`,
        link: '/dashboard',
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        modificationId,
        action,
        message: `Modification ${action}ed successfully`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Modification processing error:', error);
    if (error instanceof RateLimitError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const message = error instanceof Error ? error.message : 'An error occurred while processing the modification';
    const isExpected = message.startsWith('Unauthorized') || message.startsWith('Modification') || message.startsWith('Cannot') || message.startsWith('The item') || message.startsWith('Your account') || message.startsWith('Failed');
    return new Response(
      JSON.stringify({ error: isExpected ? message : 'An unexpected error occurred. Please try again.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

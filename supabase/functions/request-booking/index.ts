import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { itemId, startDate, endDate, renterId, ownerId, totalPrice } = await req.json();
    if (!itemId || !startDate || !endDate || !renterId || !ownerId || totalPrice == null) {
      throw new Error('Missing required fields: itemId, startDate, endDate, renterId, ownerId, totalPrice');
    }
    
    console.log('Creating rental request:', { itemId, renterId, ownerId, startDate, endDate, totalPrice });
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Verify user is authenticated AND matches renterId
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Unauthorized: No authorization header');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth verification failed:', authError);
      throw new Error('Unauthorized: Invalid token');
    }
    
    // SECURITY: Ensure the authenticated user matches the renterId
    if (user.id !== renterId) {
      console.error('User mismatch:', { authenticated: user.id, requested: renterId });
      throw new Error('Forbidden: Cannot create booking for another user');
    }

    // Check if user is suspended
    const { error: suspendError } = await supabase.rpc('check_user_not_suspended', {
      p_user_id: user.id
    });
    if (suspendError) {
      throw new Error('Your account has been suspended. Contact support for assistance.');
    }

    // Verify renter is verified
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_verified')
      .eq('id', renterId)
      .single();

    if (profileError || !profile?.is_verified) {
      console.error('Renter verification check failed:', profileError);
      throw new Error('Renter must be verified to create booking requests');
    }

    // Check for overlapping rentals (correct AND logic: existing rental overlaps if it starts before requested ends AND ends after requested starts)
    console.log('Checking for overlapping rentals:', { itemId, startDate, endDate });
    
    const { data: existingRentals, error: overlapError } = await supabase
      .from('rentals')
      .select('id, status, start_date, end_date')
      .eq('item_id', itemId)
      .in('status', ['pending_approval', 'approved', 'paid', 'active'])
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    if (overlapError) {
      console.error('Overlap check error:', overlapError);
      throw new Error('Failed to check availability');
    }

    if (existingRentals && existingRentals.length > 0) {
      console.log('Overlapping rentals found:', existingRentals);
      throw new Error('Item is not available for the selected dates');
    }
    
    // Create rental record with pending_approval status
    const { data: rental, error: rentalError } = await supabase
      .from('rentals')
      .insert({
        item_id: itemId,
        renter_id: renterId,
        owner_id: ownerId,
        start_date: startDate,
        end_date: endDate,
        total_price: totalPrice,
        status: 'pending_approval' // New: Request-Approval-Payment flow
      })
      .select()
      .single();
    
    if (rentalError) {
      console.error('Rental creation error:', rentalError);
      throw rentalError;
    }
    
    console.log('Rental request created:', rental.id);
    
    // Log rental request creation
    await supabase.from('payment_flow_logs').insert({
      rental_id: rental.id,
      stage: 'rental_requested',
      status: 'success',
      details: { itemId, renterId, ownerId, startDate, endDate, totalPrice }
    });

    // Create notification for owner about new booking request
    await supabase.from('notifications').insert({
      user_id: ownerId,
      type: 'rental_request',
      title: 'New Booking Request',
      message: 'You have a new booking request for your item',
      link: `/my-listings`
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        rentalId: rental.id,
        status: 'pending_approval',
        message: 'Booking request sent successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('Booking request error:', error);
    const message = error.message || 'An unexpected error occurred';
    const isExpected = message.startsWith('Missing') || message.startsWith('Unauthorized') || message.startsWith('Forbidden') || message.startsWith('Your account') || message.startsWith('Renter must') || message.startsWith('Item is not') || message.startsWith('Failed to check');
    return new Response(
      JSON.stringify({ error: isExpected ? message : 'An unexpected error occurred. Please try again.' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
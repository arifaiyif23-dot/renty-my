/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') || 'https://renty.my',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rentalId, action } = await req.json(); // action: 'approve' or 'reject'
    
    console.log('Processing rental approval:', { rentalId, action });
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header for user verification
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      throw new Error('Unauthorized: No authorization header');
    }

    // Extract token from Bearer header
    const token = authHeader.replace('Bearer ', '');
    
    // Verify user from token using service role client
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    console.log('User verification result:', { userId: user?.id, error: userError?.message });
    
    if (userError || !user) {
      console.error('User verification failed:', userError);
      throw new Error('Unauthorized: Invalid user token');
    }

    // Check if user is suspended
    const { error: suspendError } = await supabase.rpc('check_user_not_suspended', {
      p_user_id: user.id
    });
    if (suspendError) {
      throw new Error('Your account has been suspended. Contact support for assistance.');
    }

    // Get rental details
    const { data: rental, error: rentalError } = await supabase
      .from('rentals')
      .select('*, item:items(title), renter:profiles!rentals_renter_id_fkey(full_name)')
      .eq('id', rentalId)
      .single();

    if (rentalError || !rental) {
      console.error('Rental fetch error:', rentalError);
      throw new Error('Rental not found');
    }

    console.log('Rental found:', { id: rental.id, owner_id: rental.owner_id, status: rental.status });

    // Verify user is the owner
    if (rental.owner_id !== user.id) {
      console.error('Owner mismatch:', { rentalOwner: rental.owner_id, currentUser: user.id });
      throw new Error('Unauthorized: Only the owner can approve/reject rentals');
    }

    // Verify rental is in pending_approval status
    if (rental.status !== 'pending_approval') {
      throw new Error(`Rental cannot be ${action}ed. Current status: ${rental.status}`);
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Generate 4-digit pickup code if approving
    let pickupCode = null;
    if (action === 'approve') {
      pickupCode = Math.floor(1000 + Math.random() * 9000).toString();
    }

    // Update rental status and pickup code
    const updateData: any = { status: newStatus };
    if (pickupCode) {
      updateData.pickup_code = pickupCode;
    }

    const { error: updateError } = await supabase
      .from('rentals')
      .update(updateData)
      .eq('id', rentalId);

    if (updateError) {
      console.error('Rental update error:', updateError);
      throw updateError;
    }

    console.log(`Rental ${action}ed:`, rentalId);

    // Log the approval/rejection
    await supabase.from('payment_flow_logs').insert({
      rental_id: rentalId,
      stage: `rental_${action}ed`,
      status: 'success',
      details: { ownerId: user.id, action, timestamp: new Date().toISOString() }
    });

    // Create notification for renter
    const notificationMessage = action === 'approve' 
      ? `Your booking request for "${rental.item.title}" has been approved! You can now proceed to payment.`
      : `Your booking request for "${rental.item.title}" has been declined by the owner.`;

    await supabase.from('notifications').insert({
      user_id: rental.renter_id,
      type: action === 'approve' ? 'rental_approved' : 'rental_rejected',
      title: action === 'approve' ? 'Booking Request Approved' : 'Booking Request Declined',
      message: notificationMessage,
      link: '/dashboard'
    });

    return new Response(
      JSON.stringify({
        success: true,
        rentalId,
        status: newStatus,
        message: `Rental ${action}ed successfully`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Rental approval processing error:', error);
    const message = error.message || 'An error occurred while processing the rental';
    const isExpected = message.startsWith('Unauthorized') || message.startsWith('Rental') || message.startsWith('Your account');
    return new Response(
      JSON.stringify({ error: isExpected ? message : 'An unexpected error occurred. Please try again.' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

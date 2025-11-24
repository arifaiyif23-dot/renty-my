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
    const { rentalId, action } = await req.json(); // action: 'approve' or 'reject'
    
    console.log('Processing rental approval:', { rentalId, action });
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get auth header for user verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Unauthorized');
    }

    // Verify user from auth header
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized: Invalid user');
    }

    // Get rental details
    const { data: rental, error: rentalError } = await supabase
      .from('rentals')
      .select('*, item:items(title), renter:profiles!rentals_renter_id_fkey(full_name)')
      .eq('id', rentalId)
      .single();

    if (rentalError || !rental) {
      throw new Error('Rental not found');
    }

    // Verify user is the owner
    if (rental.owner_id !== user.id) {
      throw new Error('Unauthorized: Only the owner can approve/reject rentals');
    }

    // Verify rental is in pending_approval status
    if (rental.status !== 'pending_approval') {
      throw new Error(`Rental cannot be ${action}ed. Current status: ${rental.status}`);
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Update rental status
    const { error: updateError } = await supabase
      .from('rentals')
      .update({ status: newStatus })
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
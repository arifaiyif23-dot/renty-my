import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const payload = await req.json();
    console.log('Webhook payload received:', payload);

    const { type, record, old_record } = payload;
    
    // Handle INSERT events (new rental request)
    if (type === 'INSERT' && record.status === 'pending_approval') {
      console.log('Processing new rental request notification');
      
      // Fetch owner, renter, and item details
      const { data: rental, error: rentalError } = await supabase
        .from('rentals')
        .select(`
          *,
          item:items(title, owner:profiles!items_owner_id_fkey(full_name)),
          renter:profiles!rentals_renter_id_fkey(full_name, is_verified)
        `)
        .eq('id', record.id)
        .single();

      if (rentalError || !rental) {
        throw new Error(`Failed to fetch rental details: ${rentalError?.message}`);
      }

      // Get owner's email
      const { data: ownerAuth } = await supabase.auth.admin.getUserById(rental.owner_id);
      
      if (ownerAuth?.user?.email) {
        await resend.emails.send({
          from: 'Renty <notifications@resend.dev>',
          to: [ownerAuth.user.email],
          subject: 'New Rental Request for Your Item',
          html: `
            <h2>You have a new rental request!</h2>
            <p>Renter: ${rental.renter.full_name} ${rental.renter.is_verified ? '✓ Verified' : ''}</p>
            <p>Item: ${rental.item.title}</p>
            <p>Dates: ${new Date(rental.start_date).toLocaleDateString()} - ${new Date(rental.end_date).toLocaleDateString()}</p>
            <p>Total Price: RM ${rental.total_price}</p>
            <p><a href="${Deno.env.get('FRONTEND_URL')}/my-listings">Review Request</a></p>
          `,
        });
        console.log('New request email sent to owner');
      }
    }

    // Handle UPDATE events (status changes)
    if (type === 'UPDATE' && record.status !== old_record?.status) {
      console.log(`Processing status change: ${old_record?.status} -> ${record.status}`);

      // Fetch rental details
      const { data: rental, error: rentalError } = await supabase
        .from('rentals')
        .select(`
          *,
          item:items(title),
          renter:profiles!rentals_renter_id_fkey(full_name),
          owner:profiles!rentals_owner_id_fkey(full_name)
        `)
        .eq('id', record.id)
        .single();

      if (rentalError || !rental) {
        throw new Error(`Failed to fetch rental details: ${rentalError?.message}`);
      }

      // Status changed to 'approved' - notify renter
      if (record.status === 'approved') {
        const { data: renterAuth } = await supabase.auth.admin.getUserById(rental.renter_id);
        
        if (renterAuth?.user?.email) {
          await resend.emails.send({
            from: 'Renty <notifications@resend.dev>',
            to: [renterAuth.user.email],
            subject: 'Rental Request Approved!',
            html: `
              <h2>Great news! Your rental request has been approved.</h2>
              <p>Item: ${rental.item.title}</p>
              <p>Owner: ${rental.owner.full_name}</p>
              <p>Dates: ${new Date(rental.start_date).toLocaleDateString()} - ${new Date(rental.end_date).toLocaleDateString()}</p>
              <p>Total Price: RM ${rental.total_price}</p>
              <p><strong>Next Step:</strong> Complete your payment to confirm the booking.</p>
              <p><a href="${Deno.env.get('FRONTEND_URL')}/dashboard">Pay Now</a></p>
            `,
          });
          console.log('Approval email sent to renter');
        }
      }

      // Status changed to 'paid' - notify owner with pickup code
      if (record.status === 'paid') {
        const { data: ownerAuth } = await supabase.auth.admin.getUserById(rental.owner_id);
        
        if (ownerAuth?.user?.email) {
          await resend.emails.send({
            from: 'Renty <notifications@resend.dev>',
            to: [ownerAuth.user.email],
            subject: 'Payment Received - Rental Confirmed',
            html: `
              <h2>Payment received for your rental!</h2>
              <p>Item: ${rental.item.title}</p>
              <p>Renter: ${rental.renter.full_name}</p>
              <p>Dates: ${new Date(rental.start_date).toLocaleDateString()} - ${new Date(rental.end_date).toLocaleDateString()}</p>
              <p>Total Price: RM ${rental.total_price}</p>
              ${record.pickup_code ? `<p><strong>Pickup Code:</strong> ${record.pickup_code}</p>` : ''}
              <p>The renter will provide this code during item pickup.</p>
              <p><a href="${Deno.env.get('FRONTEND_URL')}/my-listings">View Details</a></p>
            `,
          });
          console.log('Payment confirmation email sent to owner');
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Email notification error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

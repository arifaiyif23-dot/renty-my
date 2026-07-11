import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const getFromEmail = () => {
  const customFrom = Deno.env.get('RESEND_FROM_EMAIL');
  if (customFrom) {
    if (customFrom.includes('@resend.dev')) {
      console.warn('[email] RESEND_FROM_EMAIL still uses @resend.dev — emails likely flagged as spam. Configure a verified production domain.');
    }
    return `Renty <${customFrom}>`;
  }
  console.warn('[email] RESEND_FROM_EMAIL is not set — falling back to onboarding@resend.dev. Set a production sender domain before launch.');
  return 'Renty <onboarding@resend.dev>';
};

// Helper function to log email to database
async function logEmail(
  supabase: any,
  resendEmailId: string | null,
  toEmail: string,
  subject: string,
  templateType: string,
  metadata: any = {},
  errorMessage: string | null = null
) {
  try {
    await supabase.from('email_logs').insert({
      resend_email_id: resendEmailId,
      to_email: toEmail,
      subject: subject,
      template_type: templateType,
      status: errorMessage ? 'failed' : 'sent',
      error_message: errorMessage,
      metadata: metadata
    });
    console.log(`Email logged: ${templateType} to ${toEmail}`);
  } catch (logError) {
    console.error('Failed to log email:', logError);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const resend = new Resend(resendApiKey);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const fromEmail = getFromEmail();
    console.log(`Using FROM email: ${fromEmail}`);

    const payload = await req.json();
    console.log('Webhook payload received (type):', payload.type);

    // --- Direct test-email path (used by Admin Health "Send test email") ---
    if (payload?.type === 'test' && payload?.to) {
      try {
        const result = await resend.emails.send({
          from: fromEmail,
          to: payload.to,
          subject: payload.subject || 'Renty — Test email',
          html: payload.html || '<p>Test email from Renty.</p>',
        });
        await logEmail(supabase, (result as any)?.data?.id || null, payload.to, payload.subject || 'Renty — Test email', 'test', { source: 'admin_health' });
        return new Response(JSON.stringify({ ok: true, id: (result as any)?.data?.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        await logEmail(supabase, null, payload.to, payload.subject || 'Renty — Test email', 'test', {}, err.message);
        return new Response(JSON.stringify({ error: 'Test email failed. Check server logs for details.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { type, record, old_record } = payload;
    
    
    // Handle INSERT events (new rental request)
    if (type === 'INSERT' && record.status === 'pending_approval') {
      console.log('Processing new rental request notification');
      
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

      const { data: ownerAuth } = await supabase.auth.admin.getUserById(rental.owner_id);
      
      if (ownerAuth?.user?.email) {
        const subject = 'New Rental Request for Your Item';
        const templateType = 'rental_request';
        
        try {
          const emailResult = await resend.emails.send({
            from: fromEmail,
            to: [ownerAuth.user.email],
            subject: subject,
            html: `
              <h2>You have a new rental request!</h2>
              <p>Renter: ${rental.renter.full_name} ${rental.renter.is_verified ? '✓ Verified' : ''}</p>
              <p>Item: ${rental.item.title}</p>
              <p>Dates: ${new Date(rental.start_date).toLocaleDateString()} - ${new Date(rental.end_date).toLocaleDateString()}</p>
              <p>Total Price: RM ${rental.total_price}</p>
              <p><a href="${Deno.env.get('FRONTEND_URL')}/my-listings">Review Request</a></p>
            `,
          });
          console.log('New request email sent to owner:', emailResult);
          
          await logEmail(supabase, emailResult.data?.id || null, ownerAuth.user.email, subject, templateType, {
            rental_id: record.id,
            item_title: rental.item.title
          });
        } catch (emailError: any) {
          await logEmail(supabase, null, ownerAuth.user.email, subject, templateType, { rental_id: record.id }, emailError.message);
          throw emailError;
        }
      }
    }

    // Handle UPDATE events (status changes)
    if (type === 'UPDATE' && record.status !== old_record?.status) {
      console.log(`Processing status change: ${old_record?.status} -> ${record.status}`);

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
          const subject = 'Rental Request Approved!';
          const templateType = 'rental_approved';
          
          try {
            const emailResult = await resend.emails.send({
              from: fromEmail,
              to: [renterAuth.user.email],
              subject: subject,
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
            console.log('Approval email sent to renter:', emailResult);
            
            await logEmail(supabase, emailResult.data?.id || null, renterAuth.user.email, subject, templateType, {
              rental_id: record.id,
              item_title: rental.item.title
            });
          } catch (emailError: any) {
            await logEmail(supabase, null, renterAuth.user.email, subject, templateType, { rental_id: record.id }, emailError.message);
            throw emailError;
          }
        }
      }

      // Status changed to 'paid' - notify owner with pickup code
      if (record.status === 'paid') {
        const { data: ownerAuth } = await supabase.auth.admin.getUserById(rental.owner_id);
        
        if (ownerAuth?.user?.email) {
          const subject = 'Payment Received - Rental Confirmed';
          const templateType = 'rental_paid';
          
          try {
            const emailResult = await resend.emails.send({
              from: fromEmail,
              to: [ownerAuth.user.email],
              subject: subject,
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
            console.log('Payment confirmation email sent to owner:', emailResult);
            
            await logEmail(supabase, emailResult.data?.id || null, ownerAuth.user.email, subject, templateType, {
              rental_id: record.id,
              item_title: rental.item.title,
              pickup_code: record.pickup_code
            });
          } catch (emailError: any) {
            await logEmail(supabase, null, ownerAuth.user.email, subject, templateType, { rental_id: record.id }, emailError.message);
            throw emailError;
          }
        }
      }

      // Status changed to 'rejected' - notify renter
      if (record.status === 'rejected') {
        const { data: renterAuth } = await supabase.auth.admin.getUserById(rental.renter_id);
        
        if (renterAuth?.user?.email) {
          const subject = 'Rental Request Update';
          const templateType = 'rental_rejected';
          
          try {
            const emailResult = await resend.emails.send({
              from: fromEmail,
              to: [renterAuth.user.email],
              subject: subject,
              html: `
                <h2>Update on your rental request</h2>
                <p>Unfortunately, your rental request for <strong>${rental.item.title}</strong> was not approved.</p>
                <p>Owner: ${rental.owner.full_name}</p>
                <p>Requested Dates: ${new Date(rental.start_date).toLocaleDateString()} - ${new Date(rental.end_date).toLocaleDateString()}</p>
                <p>Don't worry! There are plenty of other items available on Renty.</p>
                <p><a href="${Deno.env.get('FRONTEND_URL')}/search">Browse More Items</a></p>
              `,
            });
            console.log('Rejection email sent to renter:', emailResult);
            
            await logEmail(supabase, emailResult.data?.id || null, renterAuth.user.email, subject, templateType, {
              rental_id: record.id,
              item_title: rental.item.title
            });
          } catch (emailError: any) {
            await logEmail(supabase, null, renterAuth.user.email, subject, templateType, { rental_id: record.id }, emailError.message);
            throw emailError;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Email notification error:', error);
    const message = error.message || 'Failed to send email notification';
    const isExpected = message.startsWith('Missing') || message.startsWith('Unauthorized');
    return new Response(
      JSON.stringify({ error: isExpected ? message : 'An unexpected error occurred. Please try again.' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
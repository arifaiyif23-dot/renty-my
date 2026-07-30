import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://renty.my';

const corsHeaders = {
  'Access-Control-Allow-Origin': FRONTEND_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cronSecret = Deno.env.get('CRON_SECRET');
    const requestSecret = req.headers.get('x-cron-secret');
    if (cronSecret && (!requestSecret || requestSecret !== cronSecret)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('Starting rental status transitions...');
    const now = new Date();

    const completedCount = 0;

    // Note: Handover (paid → active) is now done manually via confirm-handover edge function.
    // Auto-activation (approved → active) removed as part of Phase 6 SOP flow.

    // No-show cancellation: cancel paid rentals where start_date + 24h passed without handover
    let noShowCount = 0;
    try {
      const { data: noShowResult } = await supabase.rpc('cancel_no_show_rentals');
      if (noShowResult && Array.isArray(noShowResult)) {
        noShowCount = noShowResult.length;
        if (noShowCount > 0) {
          console.log(`Cancelled ${noShowCount} no-show rentals`);
          for (const r of noShowResult) {
            const isVendorFault = r.no_show_type === 'vendor_no_show';
            // Renter notification
            await supabase.from('notifications').insert({
              user_id: r.renter_id,
              type: 'rental_request',
              title: isVendorFault ? 'Vendor No-Show' : 'Pickup Cancelled',
              message: isVendorFault
                ? 'The vendor did not show up for handover. Your rental has been cancelled and a full refund will be processed.'
                : 'Your rental was cancelled because pickup was not completed within 24 hours of the start date.',
              link: '/dashboard',
            });
            // Owner notification for vendor fault
            if (isVendorFault) {
              const { data: rental } = await supabase.from('rentals').select('owner_id').eq('id', r.rental_id).single();
              if (rental) {
                await supabase.from('notifications').insert({
                  user_id: rental.owner_id,
                  type: 'rental_request',
                  title: 'Vendor No-Show Recorded',
                  message: 'You did not confirm the handover. This no-show affects your trust score.',
                  link: '/dashboard',
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('No-show cancellation error:', err);
    }

    // TRANSITION: active → overdue (end_date + 3h grace period passed without return)
    let overdueCount = 0;
    try {
      const { data: overdueResult } = await supabase.rpc('mark_overdue_rentals');
      if (overdueResult && Array.isArray(overdueResult)) {
        overdueCount = overdueResult.length;
        if (overdueCount > 0) {
          console.log(`Marked ${overdueCount} rentals as overdue`);
          for (const r of overdueResult) {
            await supabase.from('notifications').insert({
              user_id: r.renter_id,
              type: 'rental_request',
              title: 'Rental Overdue',
              message: 'Your rental period has ended and the item has not been returned. Please return it immediately to avoid additional charges.',
              link: '/dashboard',
            });
          }
        }
      }
    } catch (err) {
      console.error('Overdue marking error:', err);
    }

    // TRANSITION: overdue → limited_access (24h+ without communication)
    let escalationCount = 0;
    try {
      const { data: escalationResult } = await supabase.rpc('escalate_overdue_rentals');
      if (escalationResult && Array.isArray(escalationResult)) {
        escalationCount = escalationResult.length;
        if (escalationCount > 0) {
          console.log(`Escalated ${escalationCount} overdue rentals to limited_access`);
          const rentalIds = escalationResult.map((r: { rental_id: string }) => r.rental_id);
          const { data: rentals } = await supabase
            .from('rentals')
            .select('id, renter_id, owner_id')
            .in('id', rentalIds);
          const ownerMap = new Map((rentals || []).map((r: { id: string; owner_id: string }) => [r.id, r.owner_id]));
          for (const r of escalationResult) {
            await supabase.from('notifications').insert({
              user_id: r.renter_id,
              type: 'rental_request',
              title: 'Account Restricted',
              message: 'Your account has been restricted due to an overdue rental with no communication. Please contact support to resolve this.',
              link: '/dashboard',
            });
            const ownerId = ownerMap.get(r.rental_id);
            if (ownerId) {
              await supabase.from('notifications').insert({
                user_id: ownerId,
                type: 'rental_request',
                title: 'Overdue Escalated',
                message: 'The renter has not responded for over 24h. Their account has been restricted. Admin review pending.',
                link: '/admin/rentals',
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('Overdue escalation error:', err);
    }

    // REMINDERS: 24h before return, return day, payment pending
    let reminderCount = 0;
    try {
      // 24h before return: active/overdue rentals ending in 22-26h
      const { data: nearReturn, error: nearError } = await supabase
        .from('rentals')
        .select('id, renter_id, end_date, item:items(title)')
        .in('status', ['active', 'overdue'])
        .gte('end_date', new Date(now.getTime() + 22 * 60 * 60 * 1000).toISOString())
        .lte('end_date', new Date(now.getTime() + 26 * 60 * 60 * 1000).toISOString());

      if (!nearError && nearReturn) {
        for (const r of nearReturn) {
          const title = r.item?.title || 'your rental';
          await supabase.from('notifications').insert({
            user_id: r.renter_id,
            type: 'rental_request',
            title: 'Return Reminder',
            message: `"${title}" is due for return in about 24 hours. Please prepare to return it on time.`,
            link: '/dashboard',
          }).maybeSingle().catch(() => {});
          reminderCount++;
        }
      }

      // Return day reminder: rentals ending today (within 0-2h window to avoid duplicates)
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
      const { data: dueToday } = await supabase
        .from('rentals')
        .select('id, renter_id, end_date, item:items(title)')
        .in('status', ['active', 'overdue'])
        .gte('end_date', todayStart)
        .lte('end_date', todayEnd);

      if (dueToday) {
        for (const r of dueToday) {
          const title = r.item?.title || 'your rental';
          await supabase.from('notifications').insert({
            user_id: r.renter_id,
            type: 'rental_request',
            title: 'Return Today',
            message: `"${title}" is due for return today. Please return it to avoid late charges.`,
            link: '/dashboard',
          }).maybeSingle().catch(() => {});
          reminderCount++;
        }
      }

      // Payment reminder: requested rentals not paid after 30min
      const { data: unpaid } = await supabase
        .from('rentals')
        .select('id, renter_id, created_at')
        .eq('status', 'requested')
        .lt('created_at', new Date(now.getTime() - 30 * 60 * 1000).toISOString());

      if (unpaid) {
        for (const r of unpaid) {
          await supabase.from('notifications').insert({
            user_id: r.renter_id,
            type: 'rental_request',
            title: 'Payment Reminder',
            message: 'You have a booking waiting for payment. Complete payment to secure your rental.',
            link: '/dashboard',
          }).maybeSingle().catch(() => {});
          reminderCount++;
        }
      }
    } catch (err) {
      console.error('Reminder notification error:', err);
    }

    // Log execution
    await supabase.from('cron_job_logs').insert({
      job_name: 'process-rental-transitions',
      status: 'success',
      records_processed: completedCount + reminderCount,
      executed_at: now.toISOString()
    });

    console.log(`Transitions complete: ${completedCount} completed`);

    return new Response(
      JSON.stringify({
        success: true,
        completed: completedCount,
        timestamp: now.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Rental transition error:', error);
    
    // Log error
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      await supabase.from('cron_job_logs').insert({
        job_name: 'process-rental-transitions',
        status: 'error',
        error_message: error.message,
        executed_at: new Date().toISOString()
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    const message = error.message || 'An unexpected error occurred';
    const isExpected = message.startsWith('Missing') || message.startsWith('Unauthorized') || message.startsWith('Rental') || message.startsWith('Invalid');
    return new Response(
      JSON.stringify({ error: isExpected ? message : 'An unexpected error occurred. Please try again.' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

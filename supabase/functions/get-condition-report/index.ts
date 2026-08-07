import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get('FRONTEND_URL') || 'https://renty.my';

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(req.url);
    const rentalId = url.searchParams.get('rental_id');
    const reportType = url.searchParams.get('report_type');

    if (!rentalId) {
      return new Response(JSON.stringify({ error: 'Missing rental_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify user is owner or renter
    const { data: rental } = await supabase
      .from('rentals')
      .select('owner_id, renter_id')
      .eq('id', rentalId)
      .single();

    if (!rental || (rental.owner_id !== user.id && rental.renter_id !== user.id)) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let query = supabase
      .from('condition_reports')
      .select(`
        *,
        items:condition_report_items(*),
        signatures:condition_signatures(*)
      `)
      .eq('rental_id', rentalId);

    if (reportType) {
      query = query.eq('report_type', reportType);
    }

    const { data: reports, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return new Response(JSON.stringify(reports), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('get-condition-report error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch condition reports' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

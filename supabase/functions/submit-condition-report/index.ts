import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportItem {
  category: string;
  label: string;
  condition: string;
  notes?: string;
  photo_urls?: string[];
  display_order: number;
}

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

    const { rental_id, report_type, overall_condition, overall_notes, items, action, signature_name } = await req.json();

    if (!rental_id || !report_type || !items || !Array.isArray(items)) {
      return new Response(JSON.stringify({ error: 'Missing required fields: rental_id, report_type, items' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!['pre_rental', 'post_rental'].includes(report_type)) {
      return new Response(JSON.stringify({ error: 'Invalid report_type' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify user is owner or renter of this rental
    const { data: rental } = await supabase
      .from('rentals')
      .select('owner_id, renter_id')
      .eq('id', rental_id)
      .single();

    if (!rental || (rental.owner_id !== user.id && rental.renter_id !== user.id)) {
      return new Response(JSON.stringify({ error: 'Not authorized for this rental' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Upsert the report
    const { data: existingReport } = await supabase
      .from('condition_reports')
      .select('id, status')
      .eq('rental_id', rental_id)
      .eq('report_type', report_type)
       .eq('created_by', user.id)
       .maybeSingle();

    const reportPayload: Record<string, unknown> = {
      rental_id,
      report_type,
      created_by: user.id,
      overall_condition: overall_condition || null,
      overall_notes: overall_notes || null,
    };

    let reportId: string;

    if (existingReport) {
      if (existingReport.status === 'submitted' && action !== 'resubmit') {
        return new Response(JSON.stringify({ error: 'Report already submitted' }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      reportPayload.status = action === 'submit' ? 'submitted' : 'draft';
      if (action === 'submit') reportPayload.submitted_at = new Date().toISOString();

      const { data: updated } = await supabase
        .from('condition_reports')
        .update(reportPayload)
        .eq('id', existingReport.id)
        .select('id')
        .single();
      reportId = updated!.id;

      // Delete existing items and re-insert
      await supabase.from('condition_report_items').delete().eq('report_id', reportId);
    } else {
      reportPayload.status = action === 'submit' ? 'submitted' : 'draft';
      if (action === 'submit') reportPayload.submitted_at = new Date().toISOString();

      const { data: created } = await supabase
        .from('condition_reports')
        .insert(reportPayload)
        .select('id')
        .single();
      reportId = created!.id;
    }

    // Insert items
    const reportItems: ReportItem[] = items;
    const { error: itemsError } = await supabase.from('condition_report_items').insert(
      reportItems.map((item, i) => ({
        report_id: reportId,
        category: item.category,
        label: item.label,
        condition: item.condition,
        notes: item.notes || null,
        photo_urls: item.photo_urls || [],
        display_order: item.display_order ?? i,
      }))
    );

    if (itemsError) throw itemsError;

    // Insert signature if name provided and action is submit
    if (signature_name && action === 'submit') {
      const role = rental.owner_id === user.id ? 'owner' : 'renter';
      const { error: sigError } = await supabase.from('condition_signatures').insert({
        report_id: reportId,
        signed_by: user.id,
        role,
      });
      if (sigError) console.error('signature insert error:', sigError);
    }

    return new Response(JSON.stringify({ id: reportId, status: reportPayload.status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('submit-condition-report error:', error);
    return new Response(JSON.stringify({ error: 'Failed to submit condition report' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

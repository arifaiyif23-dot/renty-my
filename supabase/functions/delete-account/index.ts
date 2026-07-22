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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized');

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const { confirmation } = await req.json();
    if (confirmation !== 'DELETE') {
      throw new Error('Please type DELETE to confirm');
    }

    // Check for active rentals
    const { data: activeRentals } = await supabase
      .from('rentals')
      .select('id')
      .eq('renter_id', user.id)
      .in('status', ['active', 'approved', 'pending_approval', 'disputed'])
      .limit(1);

    if (activeRentals && activeRentals.length > 0) {
      throw new Error('Cannot delete account with active rentals. Please complete or cancel them first.');
    }

    const { data: ownedRentals } = await supabase
      .from('rentals')
      .select('id')
      .eq('owner_id', user.id)
      .in('status', ['active', 'approved', 'pending_approval', 'disputed'])
      .limit(1);

    if (ownedRentals && ownedRentals.length > 0) {
      throw new Error('Cannot delete account with active rentals. Please complete or cancel them first.');
    }

    // Soft delete: update profile
    await supabase
      .from('profiles')
      .update({
        full_name: 'Deleted User',
        phone: null,
        avatar_url: null,
        location: null,
        is_verified: false,
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        identity_number_hash: null,
      })
      .eq('id', user.id);

    // Delete user data
    await supabase.from('sessions').delete().eq('user_id', user.id);

    // Clean up storage files
    await supabase.storage.from('verification-documents').list(user.id).then(async ({ data: files }) => {
      if (files && files.length > 0) {
        await supabase.storage.from('verification-documents').remove(files.map(f => `${user.id}/${f.name}`));
      }
    });

    await supabase.storage.from('avatars').list(user.id).then(async ({ data: files }) => {
      if (files && files.length > 0) {
        await supabase.storage.from('avatars').remove(files.map(f => `${user.id}/${f.name}`));
      }
    });

    // Clean up item images for this user
    await supabase.storage.from('item-images').list(user.id).then(async ({ data: files }) => {
      if (files && files.length > 0) {
        await supabase.storage.from('item-images').remove(files.map(f => `${user.id}/${f.name}`));
      }
    });

    // Clean up rental evidence for rentals where user was involved
    const { data: userRentals } = await supabase
      .from('rentals')
      .select('id')
      .or(`renter_id.eq.${user.id},owner_id.eq.${user.id}`);

    if (userRentals && userRentals.length > 0) {
      for (const rental of userRentals) {
        const { data: evidenceFiles } = await supabase.storage
          .from('rental-evidence')
          .list(rental.id);
        if (evidenceFiles && evidenceFiles.length > 0) {
          await supabase.storage
            .from('rental-evidence')
            .remove(evidenceFiles.map(f => `${rental.id}/${f.name}`));
        }
      }
    }

    // Admin alert
    const adminEmail = Deno.env.get('ADMIN_EMAIL');
    if (!adminEmail) {
      console.error('ADMIN_EMAIL environment variable not set');
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Account deletion initiated' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    const message = error.message || 'Account deletion failed';
    const isExpected = message.startsWith('Missing') || message.startsWith('Unauthorized') || message.startsWith('Account');
    return new Response(
      JSON.stringify({ error: isExpected ? message : 'An unexpected error occurred. Please try again.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { path, expiresIn = 900 } = await req.json(); // Default 15 minutes for security
    
    // Cap maximum expiration to 1 hour for security
    const cappedExpiresIn = Math.min(expiresIn, 3600);

    if (!path) {
      throw new Error('Missing path parameter');
    }

    // Sanitize path: prevent path traversal attacks
    const sanitizedPath = path.replace(/\.\.\//g, '').replace(/\\/g, '/').replace(/^\/+/, '');
    const bucket = sanitizedPath.split('/')[0];
    
    // Validate bucket is a known name (not empty or malformed)
    const allowedBuckets = ['verification-documents', 'item-images', 'receipts', 'rental-evidence'];
    if (!allowedBuckets.includes(bucket)) {
      throw new Error(`Invalid bucket: ${bucket}`);
    }

    // For verification documents, only the user or admins can access
    if (bucket === 'verification-documents') {
      const userId = sanitizedPath.split('/')[1];
      
      if (!userId) {
        throw new Error('Invalid document path');
      }
      
      // Check if user is accessing their own documents
      const isOwnDocument = userId === user.id;
      
      // Check if user is admin
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      const isAdmin = !!roles;
      
      if (!isOwnDocument && !isAdmin) {
        throw new Error('Forbidden: You do not have access to this document');
      }
    }

    // For item-images, verify user is the owner or admin (enforce ownership)
    if (bucket === 'item-images') {
      const { data: item } = await supabase
        .from('items')
        .select('owner_id')
        .eq('id', sanitizedPath.split('/')[1])
        .single();
      
      const isOwner = item?.owner_id === user.id;
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      const isAdmin = !!roles;
      
      if (!isOwner && !isAdmin) {
        throw new Error('Forbidden: You do not have access to this image');
      }
    }

    // Extract the file path within the bucket (remove bucket prefix)
    const filePath = sanitizedPath.substring(bucket.length + 1);

    // Generate signed URL with capped expiration
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, cappedExpiresIn);

    if (error) {
      console.error('Error generating signed URL:', error);
      throw error;
    }
    
    console.log(`Signed URL generated: path=${path}, expires_in=${cappedExpiresIn}s, user=${user.id}`);

    return new Response(
      JSON.stringify({ signedUrl: data.signedUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in generate-signed-url:', error);
    const errorMessage = error?.message || 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: errorMessage === 'Unauthorized' ? 401 : 
                errorMessage.startsWith('Forbidden') ? 403 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

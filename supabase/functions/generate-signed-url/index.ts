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

    const { path, expiresIn = 3600 } = await req.json();

    if (!path) {
      throw new Error('Missing path parameter');
    }

    // Verify user has access to this document
    // For verification documents, only the user or admins can access
    const bucket = path.split('/')[0];
    
    if (bucket === 'verification-documents') {
      const userId = path.split('/')[1];
      
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

    // Generate signed URL
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path.replace(`${bucket}/`, ''), expiresIn);

    if (error) {
      console.error('Error generating signed URL:', error);
      throw error;
    }

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

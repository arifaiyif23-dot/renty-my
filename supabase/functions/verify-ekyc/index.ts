import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') || 'https://renty.my',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EkycRequest {
  provider: 'idenfy' | 'veriff' | 'shuftipro' | 'kenal' | 'manual';
  sessionId?: string;
  userId: string;
  identityNumber?: string;
  identityNumberHash?: string;
  fullName?: string;
}

interface EkycResult {
  success: boolean;
  verificationLevel: 'kyc' | 'premium';
  provider: string;
  sessionId?: string;
  identityVerified: boolean;
  livenessPassed: boolean;
  faceMatchScore?: number;
  trustScore?: number;
  expiryDate?: string;
  rawResult?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized: No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized: Invalid token');

    const body: EkycRequest = await req.json();
    const { provider, sessionId, userId, identityNumber } = body;

    if (!provider) throw new Error('Missing required field: provider');
    if (userId !== user.id) throw new Error('Forbidden: userId mismatch');

    let result: EkycResult;

    switch (provider) {
      case 'idenfy': {
        if (!sessionId) throw new Error('sessionId required for iDenfy');
        result = await verifyWithIdenfy(sessionId);
        break;
      }
      case 'veriff': {
        if (!sessionId) throw new Error('sessionId required for Veriff');
        result = await verifyWithVeriff(sessionId);
        break;
      }
      case 'shuftipro': {
        if (!sessionId) throw new Error('sessionId required for ShuftiPro');
        result = await verifyWithShuftiPro(sessionId);
        break;
      }
      case 'kenal': {
        if (!sessionId && !identityNumberHash) throw new Error('sessionId or identityNumberHash required for Kenal.io');
        result = await verifyWithKenal(sessionId || identityNumberHash!, body.fullName);
        break;
      }
      case 'manual': {
        result = {
          success: true,
          verificationLevel: 'kyc',
          provider: 'manual',
          identityVerified: true,
          livenessPassed: false,
          trustScore: 60,
        };
        break;
      }
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    if (!result.success) {
      await supabase.from('verification_requests').insert({
        user_id: userId,
        document_type: 'ekyc',
        status: 'rejected',
        ekyc_provider: provider,
        ekyc_session_id: sessionId,
        ekyc_result: result.rawResult ?? null,
        notes: `eKYC ${provider} verification failed`,
      });

      return new Response(
        JSON.stringify({ success: false, error: 'eKYC verification failed', details: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.from('verification_requests').insert({
      user_id: userId,
      document_type: 'ekyc',
      status: 'approved',
      ekyc_provider: provider,
      ekyc_session_id: sessionId,
      ekyc_result: result.rawResult ?? null,
      verification_level: result.verificationLevel,
      verified_at: new Date().toISOString(),
    });

    await supabase
      .from('profiles')
      .update({
        verification_level: result.verificationLevel,
        ekyc_provider: provider,
        ekyc_session_id: sessionId,
        ekyc_verified_at: new Date().toISOString(),
        is_verified: true,
        trust_score: result.trustScore ?? 70,
      })
      .eq('id', userId);

    return new Response(
      JSON.stringify({
        success: true,
        verificationLevel: result.verificationLevel,
        trustScore: result.trustScore,
        provider: result.provider,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('eKYC verification error:', error);
    const message = error.message || 'Verification failed';
    const isExpected = message.startsWith('Unauthorized') || message.startsWith('Missing') || message.startsWith('Verification');
    return new Response(
      JSON.stringify({ error: isExpected ? message : 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function verifyWithIdenfy(sessionId: string): Promise<EkycResult> {
  const apiKey = Deno.env.get('IDENFY_API_KEY');
  const apiSecret = Deno.env.get('IDENFY_API_SECRET');
  if (!apiKey || !apiSecret) throw new Error('iDenfy credentials not configured');

  const response = await fetch(`https://api.idenfy.com/v2/sessions/${sessionId}`, {
    headers: {
      'Authorization': `Basic ${btoa(`${apiKey}:${apiSecret}`)}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`iDenfy API error: ${data.message || response.status}`);

  const passed = data.status === 'APPROVED' || data.status === 'VERIFIED';

  return {
    success: passed,
    verificationLevel: passed ? 'premium' : 'kyc',
    provider: 'idenfy',
    sessionId,
    identityVerified: data.identity?.verified ?? false,
    livenessPassed: data.liveness?.passed ?? false,
    faceMatchScore: data.faceMatch?.confidence ?? undefined,
    trustScore: passed ? 85 : 50,
    rawResult: data,
  };
}

async function verifyWithVeriff(sessionId: string): Promise<EkycResult> {
  const apiKey = Deno.env.get('VERIFF_API_KEY');
  const apiSecret = Deno.env.get('VERIFF_API_SECRET');
  if (!apiKey || !apiSecret) throw new Error('Veriff credentials not configured');

  const token = btoa(`${apiKey}:${apiSecret}`);
  const response = await fetch(`https://api.veriff.com/v1/sessions/${sessionId}/decisions`, {
    headers: {
      'Authorization': `Basic ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Veriff API error: ${data.message || response.status}`);

  const passed = data.status === 'approved';
  const verification = data.verification;

  return {
    success: passed,
    verificationLevel: passed ? 'premium' : 'kyc',
    provider: 'veriff',
    sessionId,
    identityVerified: verification?.person?.idNumber?.valid ?? false,
    livenessPassed: verification?.person?.liveness?.passed ?? false,
    faceMatchScore: verification?.person?.faceMatch?.confidence ?? undefined,
    trustScore: passed ? 90 : 50,
    rawResult: data,
  };
}

async function verifyWithShuftiPro(sessionId: string): Promise<EkycResult> {
  const clientId = Deno.env.get('SHUFTIPRO_CLIENT_ID');
  const secretKey = Deno.env.get('SHUFTIPRO_SECRET_KEY');
  if (!clientId || !secretKey) throw new Error('ShuftiPro credentials not configured');

  const response = await fetch(`https://api.shuftipro.com/v2/sessions/${sessionId}`, {
    headers: {
      'Authorization': `Basic ${btoa(`${clientId}:${secretKey}`)}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`ShuftiPro API error: ${data.message || response.status}`);

  const passed = data.status === 'verified';

  return {
    success: passed,
    verificationLevel: passed ? 'premium' : 'kyc',
    provider: 'shuftipro',
    sessionId,
    identityVerified: data.identity?.verified ?? false,
    livenessPassed: data.liveness?.passed ?? false,
    faceMatchScore: data.face?.confidence ?? undefined,
    trustScore: passed ? 88 : 50,
    rawResult: data,
  };
}

async function verifyWithKenal(refId: string, fullName?: string): Promise<EkycResult> {
  const apiKey = Deno.env.get('KENAL_API_KEY');
  if (!apiKey) throw new Error('KENAL_API_KEY not configured');

  const response = await fetch('https://app.kenal.io/api/v1/startEKYC', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      Name: fullName || '',
      IDNumber: refId.replace(/-/g, ''),
      RefID: crypto.randomUUID ? crypto.randomUUID() : refId,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Kenal.io API error: ${data.message || response.status}`);

  const passed = data.status === 'success';

  return {
    success: passed,
    verificationLevel: passed ? 'kyc' : 'kyc',
    provider: 'kenal',
    sessionId: refId,
    identityVerified: passed,
    livenessPassed: false,
    trustScore: passed ? 75 : 50,
    rawResult: data,
  };
}

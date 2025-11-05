import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, checkType } = await req.json();
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Gather user data for fraud analysis
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    const { data: rentals } = await supabase
      .from('rentals')
      .select('*')
      .or(`renter_id.eq.${userId},owner_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(20);

    const { data: items } = await supabase
      .from('items')
      .select('id, title, price_per_day, created_at, item_images(image_url)')
      .eq('owner_id', userId)
      .limit(10);

    const { data: messages } = await supabase
      .from('messages')
      .select('content, created_at')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(50);

    const { data: verification } = await supabase
      .from('verification_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Analyze patterns
    const userAge = profile?.created_at 
      ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const analysisPrompt = `You are an expert fraud detection analyst. Analyze this user's behavior for suspicious patterns.

USER PROFILE:
- Account Age: ${userAge} days
- Verified: ${profile?.is_verified ? 'Yes' : 'No'}
- Total Rentals (as renter): ${rentals?.filter(r => r.renter_id === userId).length || 0}
- Total Listings (as owner): ${items?.length || 0}
- Messages Sent: ${messages?.length || 0}

RECENT ACTIVITY PATTERNS:
${rentals ? `
Recent Rentals:
${rentals.slice(0, 5).map(r => 
  `- ${r.status} rental, RM${r.total_price}, ${new Date(r.created_at).toLocaleDateString()}`
).join('\n')}
` : 'No rental history'}

${items ? `
Recent Listings:
${items.slice(0, 5).map(i => 
  `- "${i.title}", RM${i.price_per_day}/day, ${new Date(i.created_at).toLocaleDateString()}`
).join('\n')}
` : 'No listings'}

${messages ? `
Recent Message Patterns:
${messages.slice(0, 10).map(m => `- "${m.content.substring(0, 100)}"`).join('\n')}
` : 'No messages'}

FRAUD DETECTION ANALYSIS:

1. **Account Behavior** (30% weight):
   - Is account age suspiciously new for activity level?
   - Verification status matches activity level?
   - Rapid creation of multiple listings?
   - Unusual booking patterns (many last-minute bookings)?

2. **Transaction Patterns** (25% weight):
   - Abnormal pricing (too cheap/expensive)?
   - Many cancelled transactions?
   - Frequent disputes or refund requests?
   - High-value items from new accounts?

3. **Communication Analysis** (20% weight):
   - Scam keywords: "Western Union", "wire transfer", "gift card", "urgent"
   - Phishing links or suspicious URLs?
   - Pressure tactics: "act now", "limited time"
   - Generic/copy-paste messages?

4. **Identity Concerns** (15% weight):
   - Verification photos appear fake?
   - Multiple accounts with similar photos?
   - Stolen identity indicators?

5. **Item Listing Quality** (10% weight):
   - Stock photos used instead of real photos?
   - Luxury items with poor descriptions?
   - Items match known stolen goods?

RISK FACTORS TO DETECT:
- Duplicate accounts (same person, different names)
- Stolen item photos (reverse image search indicators)
- Money laundering patterns
- Rental scams (fake items, bait-and-switch)
- Account takeover attempts
- Bot/automated behavior

Return ONLY valid JSON (no markdown, no extra text):
{
  "overallRiskScore": 0-100,
  "riskLevel": "low" | "medium" | "high" | "critical",
  "detectedPatterns": [
    {
      "type": "string",
      "severity": "low" | "medium" | "high",
      "description": "string",
      "evidence": "string"
    }
  ],
  "specificFlags": {
    "suspiciousAccount": boolean,
    "abnormalTransactions": boolean,
    "scamLanguage": boolean,
    "identityTheft": boolean,
    "stolenPhotos": boolean,
    "multipleAccounts": boolean,
    "botBehavior": boolean
  },
  "recommendation": "clear" | "monitor" | "review" | "suspend",
  "actionItems": ["action1", "action2"],
  "reasoning": "string explanation"
}`;

    console.log('Calling OpenAI for fraud detection...');
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5",
        messages: [
          { role: "user", content: analysisPrompt }
        ],
        max_completion_tokens: 1500
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI fraud detection failed:", response.status, errorText);
      throw new Error("OpenAI fraud detection failed");
    }

    const data = await response.json();
    const analysisContent = data.choices[0].message.content;
    const analysis = JSON.parse(analysisContent);

    // Store fraud alert if risk is medium or higher
    if (analysis.riskLevel !== 'low') {
      await supabase.from('fraud_alerts').insert({
        user_id: userId,
        alert_type: checkType || 'periodic_check',
        risk_score: analysis.overallRiskScore,
        details: analysis,
        status: 'pending'
      });
    }

    console.log('Fraud detection complete. Risk level:', analysis.riskLevel);

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        model: "gpt-5"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Fraud detection error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
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
    const { messages, sessionId, userId } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch user context for personalized support
    let userContext: any = {};
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, is_verified')
        .eq('id', userId)
        .single();
      
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();
      
      const { data: activeRentals } = await supabase
        .from('rentals')
        .select('id, status, total_price')
        .or(`renter_id.eq.${userId},owner_id.eq.${userId}`)
        .in('status', ['pending', 'approved', 'active'])
        .order('created_at', { ascending: false })
        .limit(5);

      userContext = {
        userName: profile?.full_name || 'User',
        isVerified: profile?.is_verified || false,
        walletBalance: wallet?.balance || 0,
        activeRentalsCount: activeRentals?.length || 0,
        hasActiveBookings: (activeRentals?.length || 0) > 0
      };
    }

    const systemPrompt = `You are RENTY AI Assistant, an advanced support agent for the RENTY peer-to-peer rental marketplace in Malaysia.

USER CONTEXT:
${userId ? `
- Name: ${userContext.userName}
- Verified: ${userContext.isVerified ? 'Yes' : 'No'}
- Wallet Balance: RM ${userContext.walletBalance}
- Active Bookings: ${userContext.activeRentalsCount}
` : 'Not logged in'}

YOUR CAPABILITIES:
1. **Information**: Explain features, policies, how-to guides
2. **Troubleshooting**: Help with payment issues, booking problems, verification
3. **Function Calling**: Check user data, bookings, wallet (when needed)

KEY FEATURES:
- Identity verification required before listing/renting
- Secure wallet system (escrow payments)
- Insurance: Basic RM10, Standard RM20, Premium RM30
- Delivery scheduling available
- 24-hour payment window for confirmed bookings
- Promo codes and referral rewards

COMMUNICATION STYLE:
- Friendly and professional
- Use Malay or English based on user's language
- Keep responses concise (2-4 sentences)
- Be empathetic with frustrated users
- Escalate complex issues to human agents

ESCALATION TRIGGERS:
- User mentions "fraud", "scam", "stolen", "illegal"
- Repeated technical failures
- User sentiment: frustrated or negative
- Requests beyond your capabilities

If you need to check user data or perform actions, use the provided functions.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "check_user_bookings",
          description: "Retrieve user's rental bookings (current and past)",
          parameters: {
            type: "object",
            properties: {
              status: {
                type: "string",
                enum: ["all", "pending", "approved", "active", "completed", "cancelled"],
                description: "Filter by booking status"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "check_wallet_balance",
          description: "Check user's current wallet balance and recent transactions"
        }
      },
      {
        type: "function",
        function: {
          name: "check_verification_status",
          description: "Check user's identity verification status"
        }
      },
      {
        type: "function",
        function: {
          name: "escalate_to_human",
          description: "Escalate conversation to human support agent",
          parameters: {
            type: "object",
            properties: {
              reason: {
                type: "string",
                description: "Reason for escalation"
              },
              urgency: {
                type: "string",
                enum: ["low", "medium", "high"],
                description: "Urgency level"
              }
            },
            required: ["reason", "urgency"]
          }
        }
      }
    ];

    console.log('Calling OpenAI for support chat...');
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ],
        tools,
        tool_choice: "auto",
        max_completion_tokens: 1000,
        stream: true
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI chat failed:", response.status, errorText);
      
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (response.status === 402) {
        throw new Error("OpenAI credits exhausted. Please contact support.");
      }
      throw new Error("OpenAI chat failed");
    }

    // Stream the response back to client
    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('Error in openai-support-chat:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
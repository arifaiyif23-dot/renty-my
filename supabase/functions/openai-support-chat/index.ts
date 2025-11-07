import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation
const validateInput = (messages: any[]) => {
  if (!Array.isArray(messages)) {
    throw new Error('Messages must be an array');
  }
  
  const suspiciousPatterns = [
    /ignore.*(previous|above|system).*(instruction|prompt|rule)/gi,
    /repeat.*(prompt|instruction|system)/gi,
    /you are now/gi,
    /forget.*instead/gi,
  ];
  
  return messages.map(msg => {
    const content = String(msg.content || '').slice(0, 2000);
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        throw new Error('Invalid input detected');
      }
    }
    
    return {
      role: msg.role,
      content
    };
  });
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    // Rate limiting: 20 messages per hour
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const { data: allowed } = await supabaseClient.rpc('check_rate_limit', {
      p_user_id: user.id,
      p_ip_address: ipAddress,
      p_action: 'ai_support_chat',
      p_max_attempts: 20,
      p_window_seconds: 3600
    });

    if (allowed === false) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Rate limit exceeded. Maximum 20 messages per hour.' 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { messages: rawMessages, sessionId } = await req.json();
    const messages = validateInput(rawMessages);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      throw new Error('Service configuration error');
    }

    // Fetch user context for personalized support
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('full_name, is_verified')
      .eq('id', user.id)
      .single();
    
    const { data: wallet } = await supabaseClient
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single();
    
    const { data: activeRentals } = await supabaseClient
      .from('rentals')
      .select('id, status, total_price')
      .or(`renter_id.eq.${user.id},owner_id.eq.${user.id}`)
      .in('status', ['pending', 'approved', 'active'])
      .order('created_at', { ascending: false })
      .limit(5);

    const userContext = {
      userName: profile?.full_name || 'User',
      isVerified: profile?.is_verified || false,
      walletBalance: wallet?.balance || 0,
      activeRentalsCount: activeRentals?.length || 0,
      hasActiveBookings: (activeRentals?.length || 0) > 0
    };

    const systemPrompt = `You are RENTY AI Assistant, an advanced support agent for the RENTY peer-to-peer rental marketplace in Malaysia.

USER CONTEXT:
- Name: ${userContext.userName}
- Verified: ${userContext.isVerified ? 'Yes' : 'No'}
- Wallet Balance: RM ${userContext.walletBalance}
- Active Bookings: ${userContext.activeRentalsCount}

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
      console.error("OpenAI chat failed:", response.status);
      
      if (response.status === 429) {
        throw new Error("RATE_LIMIT");
      }
      if (response.status === 402) {
        throw new Error("CREDITS_EXHAUSTED");
      }
      throw new Error("SERVICE_ERROR");
    }

    // Stream the response back to client
    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('Error in openai-support-chat:', error);
    
    // Generic error messages for security
    let userMessage = "An error occurred. Please try again.";
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message === 'RATE_LIMIT' || error.message === 'CREDITS_EXHAUSTED') {
        userMessage = "Service temporarily unavailable. Please try again later.";
        statusCode = 503;
      } else if (error.message.includes('Authentication') || error.message.includes('Rate limit')) {
        userMessage = error.message;
        statusCode = error.message.includes('Rate limit') ? 429 : 401;
      } else if (error.message.includes('Invalid input')) {
        userMessage = "Invalid input provided.";
        statusCode = 400;
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: userMessage
      }),
      { 
        status: statusCode, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

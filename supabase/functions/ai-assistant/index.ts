import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CAMPUSLINK_CONTEXT = `You are CampusLink AI, a helpful assistant for a university student marketplace and community platform.

## About CampusLink
CampusLink helps university students:
- Get academic help from peers
- Find tutoring for courses  
- Buy and sell textbooks/items
- Connect and message other students
- Build reputation through ratings

## Platform Features
1. **Posts**: Users create posts in 3 categories:
   - Academic Help: Request study assistance, project help
   - Tutoring: Find or offer tutoring services  
   - Buy & Sell: Trade textbooks, supplies, items

2. **Messaging**: Direct messages between students with real-time chat

3. **Ratings & Leaderboard**: Users rate each other after interactions, top helpers shown on leaderboard

4. **Profile**: Shows courses, year of study, bio, skills, and rating

## How to Help Users
- Answer questions about using CampusLink
- Help with search queries (suggest categories, keywords)
- Give tips for creating effective posts
- Explain features and navigation
- Be friendly, helpful, and student-focused
- Keep responses concise and actionable

## Navigation
- /feed - Browse all posts
- /create-post - Create a new post
- /messages - View conversations  
- /profile - Edit your profile
- /leaderboard - See top-rated helpers
- /user-search - Find other users`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory = [], context = '' } = await req.json();
    console.log('AI Assistant request:', { message, historyLength: conversationHistory.length });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const messages = [
      { role: 'system', content: CAMPUSLINK_CONTEXT + (context ? `\n\nAdditional context: ${context}` : '') },
      ...conversationHistory.map((msg: { role: string; content: string }) => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please try again later.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    // Return streaming response
    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('Error in ai-assistant:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

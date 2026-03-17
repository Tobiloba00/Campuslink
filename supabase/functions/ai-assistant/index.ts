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
- Make offers on posted listings

## Platform Features
1. **Posts**: Users create posts in 3 categories:
   - Academic Help: Request study assistance, project help
   - Tutoring: Find or offer tutoring services  
   - Buy & Sell: Trade textbooks, supplies, items

2. **Messaging**: Direct messages between students with real-time chat. Users can Make Offers on posts.

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

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    // Build conversation contents for Gemini
    const systemMessage = CAMPUSLINK_CONTEXT + (context ? `\n\nAdditional context: ${context}` : '');

    const contents = [
      // Include system context as first user turn
      { role: 'user', parts: [{ text: systemMessage }] },
      { role: 'model', parts: [{ text: 'Understood! I am CampusLink AI, ready to help students. How can I assist you today?' }] },
      // Include conversation history
      ...conversationHistory
        .filter((msg: any) => msg.role && msg.content)
        .map((msg: any) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        })),
      // Add the current message
      { role: 'user', parts: [{ text: message }] }
    ];

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    // Transform Gemini SSE to OpenAI-compatible SSE format for the frontend hook
    const reader = geminiResponse.body!.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            let newlineIdx: number;
            while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
              let line = buffer.slice(0, newlineIdx).trimEnd();
              buffer = buffer.slice(newlineIdx + 1);

              if (!line.startsWith('data: ')) continue;

              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === '[DONE]') continue;

              try {
                const parsed = JSON.parse(jsonStr);
                const textChunk = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (textChunk) {
                  // Re-emit in OpenAI format so existing hook works without changes
                  const openaiChunk = JSON.stringify({
                    choices: [{ delta: { content: textChunk } }]
                  });
                  controller.enqueue(encoder.encode(`data: ${openaiChunk}\n\n`));
                }
              } catch {
                // skip malformed chunks
              }
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (e) {
          console.error('Stream error:', e);
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
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

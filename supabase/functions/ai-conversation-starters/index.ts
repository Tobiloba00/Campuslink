import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postTitle, postDescription, postCategory, senderName, receiverName, receiverCourse } = await req.json();
    console.log('Generating conversation starters for:', { postTitle, senderName, receiverName });

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const systemPrompt = `You are an AI assistant for CampusLink, a university student messaging platform.
Generate 3 friendly, contextual conversation starter messages that a student could send.
Keep them natural, helpful, and academic-focused.
Return ONLY valid JSON array, no other text.`;

    const userPrompt = `Generate 3 conversation starters for this context:

Post Title: ${postTitle}
Post Category: ${postCategory}
Post Description: ${postDescription}
Sender Name: ${senderName}
Receiver Name: ${receiverName}
Receiver Course: ${receiverCourse || 'Unknown'}

Return JSON array:
[
  "First friendly message example",
  "Second helpful message example", 
  "Third engaging message example"
]

Make them specific to the post content and friendly.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: systemPrompt },
              { text: userPrompt }
            ]
          }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 300
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('Generated text:', generatedText);

    // Extract JSON from response
    let suggestions;
    try {
      const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON array found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError);
      // Fallback suggestions
      suggestions = [
        `Hi ${receiverName}! I saw your post about "${postTitle}" and would love to discuss it with you.`,
        `Hey! I'm interested in your post regarding ${postCategory}. Can we connect?`,
        `Hello ${receiverName}, your post caught my attention. I'd like to learn more about it.`
      ];
    }

    // Ensure we have exactly 3 suggestions
    if (!Array.isArray(suggestions) || suggestions.length < 3) {
      suggestions = [
        `Hi ${receiverName}! I saw your post about "${postTitle}" and would love to discuss it.`,
        `Hey! I'm interested in helping with your ${postCategory.toLowerCase()} request.`,
        `Hello ${receiverName}, I think I can assist you with this. Let's chat!`
      ];
    }

    return new Response(JSON.stringify({ suggestions: suggestions.slice(0, 3) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-conversation-starters:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        suggestions: [
          "Hi! I saw your post and would love to connect.",
          "Hey! I'm interested in discussing this with you.",
          "Hello! I think I can help with your request."
        ]
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

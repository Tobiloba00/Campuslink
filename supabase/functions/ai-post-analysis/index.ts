import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postDescription, postTitle, userProfile } = await req.json();
    console.log('Analyzing post:', { postTitle, userProfile });

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const systemPrompt = `You are an AI assistant for CampusLink, a university student platform. 
Analyze posts and provide:
1. 3-5 relevant tags (course topics, skills needed)
2. Student matching criteria
3. A short engaging campus highlight (1 sentence with emoji)
4. Category suggestion

Return ONLY valid JSON, no other text.`;

    const userPrompt = `Analyze this campus post:

Title: ${postTitle}
Description: ${postDescription}
User: ${userProfile?.course || 'Unknown'}, Year ${userProfile?.year_of_study || '?'}

Return JSON with this structure:
{
  "tags": ["tag1", "tag2", "tag3"],
  "match_criteria": {
    "courses": ["course1", "course2"],
    "skills": ["skill1", "skill2"],
    "year_preference": "any"
  },
  "campus_highlight": "🔥 Emoji + engaging one-liner",
  "auto_category": "Academic Help/Tutoring/Buy & Sell"
}`;

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
            temperature: 0.7,
            maxOutputTokens: 500
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
    let analysisData;
    try {
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError);
      // Fallback data
      analysisData = {
        tags: ["General"],
        match_criteria: { courses: [], skills: [], year_preference: "any" },
        campus_highlight: "💡 New post on CampusLink",
        auto_category: "Academic Help"
      };
    }

    return new Response(JSON.stringify(analysisData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-post-analysis:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        tags: ["General"],
        campus_highlight: "💡 New post on CampusLink"
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

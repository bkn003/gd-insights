import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      throw new Error('No audio file provided');
    }

    console.log('Received audio file:', audioFile.name, 'Size:', audioFile.size, 'Type:', audioFile.type);

    // Convert audio to base64 for AI processing
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Use Lovable AI with Gemini for audio transcription
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a transcription assistant. Your task is to accurately transcribe the audio content provided. Return ONLY the transcribed text, nothing else. If the audio is in a language other than English (like Tamil, Hindi, etc.), transcribe it in the original language but also provide an English translation in parentheses if possible. If the audio is unclear or has no speech, respond with "(No clear speech detected)".'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please transcribe the following audio recording:'
              },
              {
                type: 'input_audio',
                input_audio: {
                  data: base64Audio,
                  format: audioFile.type.includes('webm') ? 'webm' : 'mp3'
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'API quota exceeded. Please check your account.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const transcription = data.choices?.[0]?.message?.content || '';

    console.log('Transcription result:', transcription);

    return new Response(
      JSON.stringify({ transcription: transcription.trim() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to transcribe audio' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

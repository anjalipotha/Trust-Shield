// TrustShield Supabase Edge Function: create-investigation-summary
// Synthesizes case evidence, messages, URLs, and notes into structured investigation analysis
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({
          error: 'Configuration Missing',
          message: 'GEMINI_API_KEY is not configured in Supabase Edge Function secrets.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      case_reference,
      title,
      description,
      incident_date,
      related_messages,
      related_urls,
      notes,
      evidence_items,
    } = await req.json();

    const prompt = `You are a Digital Forensics & Cybercrime Investigation Analyst at TrustShield.
Generate an objective, rigorous case investigation summary based ONLY on the evidence and facts provided below.

Case Reference: ${case_reference}
Case Title: ${title}
Incident Date: ${incident_date || 'Unspecified'}
Incident Description:
"""
${description || 'None provided'}
"""

Related Messages:
${JSON.stringify(related_messages || [], null, 2)}

Related URLs / Indicators:
${JSON.stringify(related_urls || [], null, 2)}

Investigation Notes:
${JSON.stringify(notes || [], null, 2)}

Evidence Files Inventory:
${JSON.stringify(evidence_items || [], null, 2)}

CRITICAL FORENSIC REQUIREMENTS:
1. Clearly separate:
   - USER-PROVIDED FACTS (what the user directly witnessed/experienced).
   - UNVERIFIED ALLEGATIONS (claims without technical or independent proof).
   - API-VERIFIED FINDINGS (threat feed matches, blacklist checks).
   - AI-GENERATED INTERPRETATIONS (contextual heuristics and likelihoods).
   - MISSING OR INCONCLUSIVE INFORMATION (gaps in the evidentiary trail).
2. DO NOT invent victims, suspects, or facts not in the input.
3. State explicitly that TrustShield does not replace official law enforcement, does not officially file police reports, and does not establish legal criminal guilt.
4. Output strictly valid JSON matching the schema below.

JSON Schema:
{
  "executive_summary": string,
  "user_facts": string[],
  "unverified_allegations": string[],
  "verified_technical_indicators": string[],
  "ai_analysis": string,
  "evidentiary_gaps": string[],
  "recommended_next_steps": string[],
  "disclaimer": string
}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      return new Response(
        JSON.stringify({ error: 'AI Analysis Failed', message: 'Unable to summarize investigation.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    const summary = JSON.parse(rawText || '{}');

    return new Response(
      JSON.stringify({
        success: true,
        case_reference,
        generated_at: new Date().toISOString(),
        summary,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'Server Error', message: err.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

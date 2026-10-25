// TrustShield Supabase Edge Function: analyze-message
// Detects phishing, impersonation, credential harvesting, urgency triggers
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
          configured: false,
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { message, source } = await req.json();
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Validation Error', message: 'A non-empty message string is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (message.length > 8000) {
      return new Response(
        JSON.stringify({ error: 'Payload Too Large', message: 'Message exceeds 8,000 characters limit.' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Gemini API (gemini-3.8-flash)
    const prompt = `You are TrustShield's Senior Cybersecurity Threat Analyst.
Analyze the following user-submitted message for security threats, phishing, payment urgency, OTP/credential harvesting, social engineering, and fraud.

Message Source: ${source || 'Unknown / User Input'}
Message Content:
"""
${message}
"""

Evaluate the following security indicators:
1. Urgent or coercive payment demands / deadline pressure.
2. Requests for passwords, one-time passwords (OTP), 2FA codes, PINs, or confidential credentials.
3. Impersonation of trusted financial institutions, tax agencies, law enforcement, or tech brands.
4. Unrealistic lottery wins, prizes, unexpected deliveries, or fake job offers.
5. Suspicious hyperlinks, shortened URLs, or deceptive typosquatting.
6. Manipulative, threatening, or emotional language.

CRITICAL INSTRUCTIONS:
- You must return ONLY valid JSON matching the exact schema specified below.
- Do NOT classify a message as definitely fraudulent solely on language suspicion; distinguish AI heuristics from verified threat intelligence.
- Never suggest that the user reply to the sender with passwords or OTPs.
- Identify extracted links if present.

JSON Schema:
{
  "risk_level": "low" | "medium" | "high" | "critical",
  "risk_score": integer between 0 and 100,
  "summary": string (concise 1-2 sentence executive summary),
  "suspicious_indicators": string[] (list of specific detected patterns),
  "suspicious_phrases": string[] (actual quotes/phrases from message that caused concern),
  "extracted_links": string[] (any URLs or domains found in message),
  "recommended_actions": string[] (concrete defensive actions the user should take),
  "limitations": string (statement of AI limitations and what requires independent verification)
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
      const errText = await geminiRes.text();
      return new Response(
        JSON.stringify({
          error: 'Gemini Analysis Failed',
          providerStatus: geminiRes.status,
          message: 'The AI analysis service was unable to complete the request.',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    const analysis = JSON.parse(rawText || '{}');

    return new Response(
      JSON.stringify({
        success: true,
        source: source || 'Unspecified',
        timestamp: new Date().toISOString(),
        analysis,
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

// TrustShield Supabase Edge Function: analyze-product
// E-commerce listing & marketplace scam assessment
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

    const {
      product_name,
      listing_url,
      seller_name,
      advertised_price,
      product_description,
      additional_context,
    } = await req.json();

    if (!product_name || typeof product_name !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Validation Error', message: 'Product name is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prompt = `You are TrustShield's Senior E-Commerce Consumer Fraud Analyst.
Evaluate the following online product listing / seller claim for counterfeit risks, non-delivery scams, fake storefront indicators, and deceptive pricing tactics.

Product Details:
- Product Name: ${product_name}
- Listing URL: ${listing_url || 'None provided'}
- Seller / Storefront: ${seller_name || 'Unknown / Unlisted'}
- Advertised Price: ${advertised_price || 'Unknown'}
- Product Description / Claims:
"""
${product_description || 'None provided'}
"""
- Additional Context / Observations:
"""
${additional_context || 'None'}
"""

ASSESSMENT CRITERIA:
1. Unrealistic discounts (e.g. 80-95% off high-demand luxury items, latest iPhones, or GPUs).
2. Suspicious seller credentials or absence of physical business address and verifiable corporate identity.
3. Inconsistent specifications, stolen stock photos, or broken translation grammar.
4. Missing return policies, escrow protection, or verified customer reviews.
5. High-risk payment requests: demanding Western Union, wire transfer, cryptocurrency, gift cards, or offline Zelle/Venmo payments.
6. Lookalike / typosquatting domains (e.g. apple-store-official-discounts.xyz).

IMPORTANT RULES:
- Do NOT claim a product is definitely counterfeit or a seller is legally fraudulent without conclusive proof.
- If reliable verification data is absent or insufficient, label risk_level as "inconclusive" and specify exactly what manual verification the buyer must perform.
- Output ONLY valid JSON adhering to the schema.

JSON Schema:
{
  "risk_level": "low" | "medium" | "high" | "critical" | "inconclusive",
  "risk_score": integer between 0 and 100,
  "summary": string,
  "warning_signs": string[],
  "verification_tips": string[],
  "payment_risk_warning": string,
  "limitations": string
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
        JSON.stringify({
          error: 'AI Analysis Failed',
          message: 'Unable to complete product scam analysis at this time.',
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
        product_name,
        listing_url,
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

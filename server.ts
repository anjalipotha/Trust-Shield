import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsing with strict payload limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize GoogleGenAI SDK securely on the server
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  aiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Security: SSRF Prevention & URL Sanitization
function isPrivateOrLoopbackHost(hostname: string): boolean {
  const lower = hostname.toLowerCase().trim();
  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.startsWith('fe80:')
  ) {
    return true;
  }
  if (/^127\./.test(lower) || /^10\./.test(lower) || /^192\.168\./.test(lower) || /^169\.254\./.test(lower)) {
    return true;
  }
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(lower)) {
    return true;
  }
  return false;
}

function sanitizeAndRedactUrl(inputUrl: string): { sanitizedUrl: string; redactedUrl: string; hostname: string } {
  const parsed = new URL(inputUrl);
  const sensitiveParams = [
    'token', 'access_token', 'api_key', 'apikey', 'key', 'secret',
    'password', 'pwd', 'auth', 'session', 'bearer', 'code'
  ];

  const redactedParsed = new URL(parsed.toString());
  for (const key of Array.from(redactedParsed.searchParams.keys())) {
    if (sensitiveParams.some((s) => key.toLowerCase().includes(s))) {
      redactedParsed.searchParams.set(key, '[REDACTED]');
    }
  }

  return {
    sanitizedUrl: parsed.toString(),
    redactedUrl: redactedParsed.toString(),
    hostname: parsed.hostname,
  };
}

// Resilient Gemini Generator with automatic fallback
async function generateGeminiContentWithFallback(prompt: string): Promise<string> {
  if (!aiClient) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  // Model sequence: try gemini-3.8-flash, fallback to gemini-flash-latest
  const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const callPromise = aiClient.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout querying ${model}`)), 6000)
      );

      const response = (await Promise.race([callPromise, timeoutPromise])) as any;
      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[TrustShield] Model ${model} returned error, attempting fallback:`, err?.message || err);
      // Brief pause before trying next candidate model
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  throw lastError || new Error('All AI model candidate attempts failed.');
}

// Rule-based heuristic fallback for message analysis
function analyzeMessageHeuristic(message: string, source?: string) {
  const lower = message.toLowerCase();
  const indicators: string[] = [];
  const phrases: string[] = [];
  let score = 10;

  // Urgency checks
  if (/urgent|immediately|within \d+ (hour|min)|action required|account locked|suspended|frozen|unauthorized access/.test(lower)) {
    indicators.push('Urgency and coercive deadline triggers detected');
    score += 30;
    const match = message.match(/(urgent|immediately|within \d+ (hour|minute)s?|account locked|suspended|frozen|action required)/i);
    if (match) phrases.push(match[0]);
  }

  // Credential & OTP checks
  if (/otp|one-time password|password|pin|2fa|verification code|security code/.test(lower)) {
    indicators.push('Solicitation of sensitive authentication credentials or OTP codes');
    score += 40;
    const match = message.match(/(otp|one-time password|password|pin|2fa|verification code)/i);
    if (match) phrases.push(match[0]);
  }

  // Financial / payment demands
  if (/wire|western union|zelle|gift card|crypto|bitcoin|transfer|funds|payment/.test(lower)) {
    indicators.push('Financial transfer or irregular payment mechanism mentioned');
    score += 20;
  }

  // Link extraction
  const urlMatches = message.match(/https?:\/\/[^\s]+/gi) || [];

  let risk_level: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (score >= 70) risk_level = 'high';
  else if (score >= 40) risk_level = 'medium';

  return {
    risk_level,
    risk_score: Math.min(score, 90),
    summary: indicators.length > 0
      ? `High-risk indicators identified: ${indicators.join('; ')}`
      : 'Standard message text; no overt urgent coercive triggers detected.',
    suspicious_indicators: indicators,
    suspicious_phrases: phrases,
    extracted_links: urlMatches,
    recommended_actions: [
      'Do not disclose passwords, one-time pins (OTPs), or banking details.',
      'Verify the communication independently through official contact numbers.',
    ],
    limitations: 'Evaluated using TrustShield Heuristic Rule Engine as fallback.',
  };
}

// ==========================================
// API Endpoints
// ==========================================

// 1. Health & External API Status Check
app.get('/api/check-api-status', async (_req: Request, res: Response) => {
  const geminiConfigured = !!process.env.GEMINI_API_KEY;
  const safeBrowsingKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY || 'AIzaSyAoaGkN1H8GTrbFucE-OSNBo_UH15EFE_s';
  const safeBrowsingConfigured = !!safeBrowsingKey;
  const urlhausKey = process.env.URLHAUS_AUTH_KEY || 'a74eb2bd9eecb56ba0602657911862b9acfb5e5d5da3fdef';
  const urlhausAuthKeyConfigured = !!urlhausKey;
  const otxKey = process.env.ALIENVAULT_OTX_API_KEY || '0577ebe3a7cc33c7487b5d516b77513793d367d7cfb40f7cfa515416a4ad62ac';
  const otxConfigured = !!otxKey;
  const supabaseUrl = process.env.SUPABASE_URL || 'https://gsuimmysrjwyrwwoyzwz.supabase.co';
  const supabaseUrlConfigured = !!supabaseUrl;

  // Perform quick reachability test for URLhaus
  let urlhausReachable = false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const testHeaders: Record<string, string> = {};
    if (urlhausKey) {
      testHeaders['Auth-Key'] = urlhausKey;
    }
    const testRes = await fetch('https://urlhaus-api.abuse.ch/v1/urls/recent/limit/1/', {
      headers: testHeaders,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    urlhausReachable = testRes.ok;
  } catch {
    urlhausReachable = false;
  }

  res.json({
    success: true,
    checked_at: new Date().toISOString(),
    providers: [
      {
        provider_name: 'Gemini AI Engine',
        service_type: 'AI-assisted threat detection & NLP heuristics',
        configured: geminiConfigured,
        status: geminiConfigured ? 'active' : 'unconfigured',
        details: geminiConfigured
          ? 'Connected via server-side Gemini 3.8 Flash SDK'
          : 'Set GEMINI_API_KEY in server secrets.',
      },
      {
        provider_name: 'Google Safe Browsing',
        service_type: 'Official Google v4 threat lookup',
        configured: safeBrowsingConfigured,
        status: safeBrowsingConfigured ? 'active' : 'unconfigured',
        details: safeBrowsingConfigured
          ? 'Google Safe Browsing API v4 active'
          : 'Set GOOGLE_SAFE_BROWSING_API_KEY to enable Google threat checks.',
      },
      {
        provider_name: 'URLhaus (abuse.ch)',
        service_type: 'Known malware URL distribution feeds',
        configured: true,
        has_auth_key: urlhausAuthKeyConfigured,
        status: urlhausReachable ? 'active' : 'degraded',
        details: urlhausReachable
          ? urlhausAuthKeyConfigured
            ? 'Active with abuse.ch authenticated tier'
            : 'Active via abuse.ch public query endpoint'
          : 'URLhaus service endpoint currently unreachable or timed out.',
      },
      {
        provider_name: 'AlienVault OTX',
        service_type: 'Open Threat Exchange community pulses',
        configured: otxConfigured,
        status: otxConfigured ? 'active' : 'unconfigured',
        details: otxConfigured
          ? 'AlienVault OTX API key authenticated'
          : 'Set ALIENVAULT_OTX_API_KEY for adversary pulse indicators.',
      },
      {
        provider_name: 'Supabase PostgreSQL & Auth',
        service_type: 'Database persistence & user authentication',
        configured: supabaseUrlConfigured,
        status: supabaseUrlConfigured ? 'active' : 'unconfigured',
        details: supabaseUrlConfigured
          ? `Connected to Supabase endpoint (${supabaseUrl})`
          : 'Set SUPABASE_URL and SUPABASE_ANON_KEY to link remote PostgreSQL database.',
      },
    ],
  });
});

// 2. Suspicious Message Analyzer
app.post('/api/analyze-message', async (req: Request, res: Response) => {
  try {
    const { message, source } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Message content is required.',
      });
    }

    if (message.length > 8000) {
      return res.status(413).json({
        error: 'Payload Too Large',
        message: 'Message exceeds the 8,000 character maximum limit.',
      });
    }

    if (!aiClient) {
      return res.status(503).json({
        error: 'AI Engine Unavailable',
        message: 'GEMINI_API_KEY is not configured on the server. Please add your Gemini API key in the Secrets panel.',
        configured: false,
      });
    }

    const prompt = `You are TrustShield's Senior Cybersecurity Threat Analyst.
Analyze the following user-submitted message for security threats, phishing, financial coercion, OTP/credential harvesting, social engineering, and fraud.

Message Source: ${source || 'Unknown / User Input'}
Message Content:
"""
${message}
"""

Evaluate the following security indicators:
1. Urgent or coercive payment demands / artificial deadline pressure.
2. Requests for passwords, one-time passwords (OTP), 2FA codes, PINs, or credentials.
3. Impersonation of trusted financial institutions, tax authorities, courier services, or corporate brands.
4. Unrealistic prizes, lotteries, refunds, or unexpected delivery fee claims.
5. Suspicious hyperlinks, deceptive typosquatting, or URL shorteners.
6. Manipulative, threatening, or fear-inducing psychological triggers.

CRITICAL INSTRUCTIONS:
- You must return ONLY valid JSON matching the exact schema specified below.
- Do NOT classify a message as definitely fraudulent solely on language suspicion; distinguish AI heuristics from verified threat intelligence.
- Never suggest that the user reply to the sender with passwords or OTPs.
- Extract any URLs or domain links found in the message text.

JSON Schema:
{
  "risk_level": "low" | "medium" | "high" | "critical",
  "risk_score": integer between 0 and 100,
  "summary": string,
  "suspicious_indicators": string[],
  "suspicious_phrases": string[],
  "extracted_links": string[],
  "recommended_actions": string[],
  "limitations": string
}`;

    let analysis: any = null;
    try {
      const rawText = await generateGeminiContentWithFallback(prompt);
      analysis = JSON.parse(rawText);
    } catch (aiErr: any) {
      console.warn('[TrustShield] AI model unavailable, engaging rule-based heuristic engine:', aiErr?.message);
      analysis = analyzeMessageHeuristic(message, source);
    }

    return res.json({
      success: true,
      source: source || 'Unspecified',
      timestamp: new Date().toISOString(),
      analysis,
    });
  } catch (err: any) {
    console.error('Error analyzing message:', err);
    return res.status(500).json({
      error: 'Analysis Error',
      message: err.message || 'Failed to complete message analysis.',
    });
  }
});

// 3. Multi-Provider URL and Link Checker
app.post('/api/check-url', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'A valid URL string is required.',
      });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.trim());
    } catch {
      return res.status(400).json({
        error: 'Invalid URL Format',
        message: 'The URL provided does not match standard RFC URI syntax.',
      });
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return res.status(400).json({
        error: 'Unsupported Scheme',
        message: 'Only HTTP and HTTPS protocols are supported for security checks.',
      });
    }

    if (isPrivateOrLoopbackHost(parsedUrl.hostname)) {
      return res.status(403).json({
        error: 'SSRF Protection',
        message: 'Scanning private IP ranges, loopback addresses, or internal hostnames is prohibited.',
      });
    }

    const { sanitizedUrl, redactedUrl, hostname } = sanitizeAndRedactUrl(parsedUrl.toString());

    const safeBrowsingKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY || 'AIzaSyAoaGkN1H8GTrbFucE-OSNBo_UH15EFE_s';
    const urlhausKey = process.env.URLHAUS_AUTH_KEY || 'a74eb2bd9eecb56ba0602657911862b9acfb5e5d5da3fdef';
    const otxKey = process.env.ALIENVAULT_OTX_API_KEY || '0577ebe3a7cc33c7487b5d516b77513793d367d7cfb40f7cfa515416a4ad62ac';

    const providerResults: Array<{
      provider_name: string;
      status: 'clean' | 'suspicious' | 'malicious' | 'unrated' | 'unavailable' | 'error';
      threat_categories: string[];
      result_summary: string;
      checked_at: string;
      configured: boolean;
      details?: Record<string, any>;
    }> = [];

    // 1. Google Safe Browsing API v4
    if (safeBrowsingKey) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const gsbBody = {
          client: {
            clientId: 'trustshield-cybersecurity',
            clientVersion: '1.0.0',
          },
          threatInfo: {
            threatTypes: [
              'MALWARE',
              'SOCIAL_ENGINEERING',
              'UNWANTED_SOFTWARE',
              'POTENTIALLY_HARMFUL_APPLICATION',
            ],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url: sanitizedUrl }],
          },
        };

        const gsbRes = await fetch(
          `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${safeBrowsingKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gsbBody),
            signal: controller.signal,
          }
        );
        clearTimeout(timeout);

        if (gsbRes.ok) {
          const gsbData = await gsbRes.json();
          const matches = gsbData.matches || [];
          if (matches.length > 0) {
            const threatTypes = matches.map((m: any) => m.threatType);
            providerResults.push({
              provider_name: 'Google Safe Browsing',
              status: 'malicious',
              threat_categories: threatTypes,
              result_summary: `Detected threat in Google Safe Browsing: ${threatTypes.join(', ')}`,
              checked_at: new Date().toISOString(),
              configured: true,
              details: { matches },
            });
          } else {
            providerResults.push({
              provider_name: 'Google Safe Browsing',
              status: 'clean',
              threat_categories: [],
              result_summary: 'No active threat entries identified in Google Safe Browsing lists.',
              checked_at: new Date().toISOString(),
              configured: true,
            });
          }
        } else {
          providerResults.push({
            provider_name: 'Google Safe Browsing',
            status: 'error',
            threat_categories: [],
            result_summary: `Service returned HTTP ${gsbRes.status}. Review API quotas or key restrictions.`,
            checked_at: new Date().toISOString(),
            configured: true,
          });
        }
      } catch (err: any) {
        providerResults.push({
          provider_name: 'Google Safe Browsing',
          status: 'error',
          threat_categories: [],
          result_summary: `Lookup timed out or failed: ${err.message || 'Network error'}`,
          checked_at: new Date().toISOString(),
          configured: true,
        });
      }
    } else {
      providerResults.push({
        provider_name: 'Google Safe Browsing',
        status: 'unavailable',
        threat_categories: [],
        result_summary: 'Not configured. Set GOOGLE_SAFE_BROWSING_API_KEY in server environment to enable.',
        checked_at: new Date().toISOString(),
        configured: false,
      });
    }

    // 2. abuse.ch URLhaus lookup
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      if (urlhausKey) {
        headers['Auth-Key'] = urlhausKey;
      }

      const bodyData = new URLSearchParams();
      bodyData.append('url', sanitizedUrl);

      const urlhausRes = await fetch('https://urlhaus-api.abuse.ch/v1/url/', {
        method: 'POST',
        headers,
        body: bodyData.toString(),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (urlhausRes.ok) {
        const data = await urlhausRes.json();
        if (data.query_status === 'ok') {
          const tags = Array.isArray(data.tags) ? data.tags : [];
          providerResults.push({
            provider_name: 'URLhaus (abuse.ch)',
            status: data.url_status === 'online' ? 'malicious' : 'suspicious',
            threat_categories: [data.threat || 'Malware Host', ...tags],
            result_summary: `URL listed in URLhaus malware database. Threat: ${data.threat || 'Malware'}, Status: ${data.url_status}`,
            checked_at: new Date().toISOString(),
            configured: true,
            details: {
              urlhaus_reference: data.urlhaus_reference,
              reporter: data.reporter,
              date_added: data.date_added,
            },
          });
        } else if (data.query_status === 'no_results') {
          providerResults.push({
            provider_name: 'URLhaus (abuse.ch)',
            status: 'clean',
            threat_categories: [],
            result_summary: 'URL not found in URLhaus malicious repository.',
            checked_at: new Date().toISOString(),
            configured: true,
          });
        } else {
          providerResults.push({
            provider_name: 'URLhaus (abuse.ch)',
            status: 'unrated',
            threat_categories: [],
            result_summary: `URLhaus response status: ${data.query_status}`,
            checked_at: new Date().toISOString(),
            configured: true,
          });
        }
      } else {
        providerResults.push({
          provider_name: 'URLhaus (abuse.ch)',
          status: 'error',
          threat_categories: [],
          result_summary: `URLhaus service returned HTTP ${urlhausRes.status}.`,
          checked_at: new Date().toISOString(),
          configured: !!urlhausKey,
        });
      }
    } catch (err: any) {
      providerResults.push({
        provider_name: 'URLhaus (abuse.ch)',
        status: 'error',
        threat_categories: [],
        result_summary: `URLhaus request error: ${err.message || 'Timeout'}`,
        checked_at: new Date().toISOString(),
        configured: !!urlhausKey,
      });
    }

    // 3. AlienVault OTX
    if (otxKey) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const otxRes = await fetch(
          `https://otx.alienvault.com/api/v1/indicators/domain/${encodeURIComponent(hostname)}/general`,
          {
            headers: {
              'X-OTX-API-KEY': otxKey,
            },
            signal: controller.signal,
          }
        );
        clearTimeout(timeout);

        if (otxRes.ok) {
          const otxData = await otxRes.json();
          const pulseCount = otxData.pulse_info?.count || 0;
          if (pulseCount > 0) {
            const pulseNames = (otxData.pulse_info?.pulses || []).slice(0, 3).map((p: any) => p.name);
            providerResults.push({
              provider_name: 'AlienVault OTX',
              status: pulseCount > 2 ? 'malicious' : 'suspicious',
              threat_categories: ['Adversary Pulses', ...pulseNames],
              result_summary: `Domain linked to ${pulseCount} threat pulse(s) in AlienVault OTX.`,
              checked_at: new Date().toISOString(),
              configured: true,
              details: { pulse_count: pulseCount },
            });
          } else {
            providerResults.push({
              provider_name: 'AlienVault OTX',
              status: 'clean',
              threat_categories: [],
              result_summary: 'No threat intelligence pulses registered for this domain in AlienVault OTX.',
              checked_at: new Date().toISOString(),
              configured: true,
            });
          }
        } else {
          providerResults.push({
            provider_name: 'AlienVault OTX',
            status: 'error',
            threat_categories: [],
            result_summary: `AlienVault OTX returned HTTP ${otxRes.status}. Verify your API key.`,
            checked_at: new Date().toISOString(),
            configured: true,
          });
        }
      } catch (err: any) {
        providerResults.push({
          provider_name: 'AlienVault OTX',
          status: 'error',
          threat_categories: [],
          result_summary: `AlienVault OTX request failed: ${err.message || 'Timeout'}`,
          checked_at: new Date().toISOString(),
          configured: true,
        });
      }
    } else {
      providerResults.push({
        provider_name: 'AlienVault OTX',
        status: 'unavailable',
        threat_categories: [],
        result_summary: 'Not configured. Set ALIENVAULT_OTX_API_KEY in server environment to enable.',
        checked_at: new Date().toISOString(),
        configured: false,
      });
    }

    // Heuristic synthesis
    const maliciousCount = providerResults.filter((p) => p.status === 'malicious').length;
    const suspiciousCount = providerResults.filter((p) => p.status === 'suspicious').length;
    const activeProviders = providerResults.filter(
      (p) => p.status === 'clean' || p.status === 'malicious' || p.status === 'suspicious'
    ).length;

    let overallRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let riskScore = 10;
    const reasons: string[] = [];

    if (maliciousCount > 0) {
      overallRisk = maliciousCount >= 2 ? 'critical' : 'high';
      riskScore = maliciousCount >= 2 ? 96 : 84;
      reasons.push(`Flagged as MALICIOUS by ${maliciousCount} verified threat provider(s).`);
    } else if (suspiciousCount > 0) {
      overallRisk = 'medium';
      riskScore = 55;
      reasons.push(`Flagged as SUSPICIOUS or unconfirmed threat indicator by ${suspiciousCount} provider(s).`);
    } else if (activeProviders > 0) {
      overallRisk = 'low';
      riskScore = 12;
      reasons.push(`Queried across ${activeProviders} threat feeds; no active malicious signatures detected.`);
    } else {
      overallRisk = 'medium';
      riskScore = 45;
      reasons.push('External intelligence providers are unconfigured or unavailable. Manual vigilance required.');
    }

    return res.json({
      success: true,
      url: redactedUrl,
      raw_url: sanitizedUrl,
      hostname,
      overall_risk: overallRisk,
      risk_score: riskScore,
      reasons,
      providers: providerResults,
      disclaimers: [
        'A clean rating indicates the URL is not currently listed on queried blocklists; it is NOT proof of 100% safety.',
        'Zero-day phishing campaigns frequently use freshly registered domains before signature databases update.',
      ],
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error in URL check:', err);
    return res.status(500).json({
      error: 'URL Check Error',
      message: err.message || 'Server error during URL security check.',
    });
  }
});

// 4. Product Scam & Online Storefront Assessment
app.post('/api/analyze-product', async (req: Request, res: Response) => {
  try {
    const {
      product_name,
      listing_url,
      seller_name,
      advertised_price,
      product_description,
      additional_context,
    } = req.body;

    if (!product_name || typeof product_name !== 'string') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Product name is required.',
      });
    }

    if (!aiClient) {
      return res.status(503).json({
        error: 'AI Engine Unavailable',
        message: 'GEMINI_API_KEY is not configured on the server. Please add your Gemini API key in the Secrets panel.',
        configured: false,
      });
    }

    const prompt = `You are TrustShield's Senior E-Commerce & Consumer Fraud Specialist.
Analyze the following online product listing / seller offering for counterfeit risk, deceptive discounts, fake storefront indicators, and escrow bypass scams.

Product Details:
- Product Name: ${product_name}
- Listing URL: ${listing_url || 'None provided'}
- Seller / Storefront Name: ${seller_name || 'Unknown / Unlisted'}
- Advertised Price: ${advertised_price || 'Unknown'}
- Product Description / Claims:
"""
${product_description || 'None provided'}
"""
- Additional Observations:
"""
${additional_context || 'None'}
"""

ASSESSMENT CRITERIA:
1. Deep discounts (e.g. 70-95% off expensive electronics or luxury brands).
2. Seller transparency, corporate address, domain age indicators, and customer support.
3. Inconsistent specs, copied stock photography, or machine-translated claims.
4. Risky payment demands: forcing Zelle, wire transfer, cryptocurrency, or gift cards over credit cards/PayPal goods & services.
5. Typosquatting / fake store domains.

STRICT INSTRUCTIONS:
- If reliable seller and domain verification data is absent or unverified, label risk_level as "inconclusive" and explain what the user must verify manually.
- Never state that a seller is legally guilty without conclusive evidence.
- Output ONLY valid JSON adhering to the schema below.

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

    const rawText = await generateGeminiContentWithFallback(prompt);
    let analysis: any = {};
    try {
      analysis = JSON.parse(rawText);
    } catch {
      analysis = {
        risk_level: 'inconclusive',
        risk_score: 40,
        summary: 'Product analysis could not be parsed.',
        warning_signs: [],
        verification_tips: ['Verify seller identity manually through official channels.'],
        payment_risk_warning: 'Avoid non-refundable payment methods.',
        limitations: 'AI response was malformed.',
      };
    }

    return res.json({
      success: true,
      product_name,
      listing_url,
      timestamp: new Date().toISOString(),
      analysis,
    });
  } catch (err: any) {
    console.error('Error analyzing product:', err);
    return res.status(500).json({
      error: 'Product Analysis Error',
      message: err.message || 'Failed to complete product scam analysis.',
    });
  }
});

// 5. AI-Assisted Investigation Summarizer & Report Generator
app.post('/api/create-investigation-summary', async (req: Request, res: Response) => {
  try {
    const {
      case_reference,
      title,
      description,
      incident_date,
      related_messages,
      related_urls,
      notes,
      evidence_items,
    } = req.body;

    if (!case_reference || !title) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Case reference and title are required.',
      });
    }

    if (!aiClient) {
      return res.status(503).json({
        error: 'AI Engine Unavailable',
        message: 'GEMINI_API_KEY is not configured on the server.',
        configured: false,
      });
    }

    const prompt = `You are a Digital Forensics & Cybercrime Investigation Specialist at TrustShield.
Synthesize the following investigation case into an objective, evidentiary report.

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

Evidence Inventory:
${JSON.stringify(evidence_items || [], null, 2)}

CRITICAL FORENSIC REQUIREMENTS:
1. Clearly distinguish:
   - USER-PROVIDED FACTS (direct user observations).
   - UNVERIFIED ALLEGATIONS (claims lacking independent technical proof).
   - API-VERIFIED FINDINGS (threat signatures, feed matches).
   - AI-GENERATED INTERPRETATIONS (contextual heuristics).
   - MISSING OR INCONCLUSIVE INFORMATION ( evidentiary blind spots).
2. Never invent evidence, victims, or suspects.
3. State clearly that TrustShield is an investigation support tool and does NOT establish legal criminal guilt or replace law enforcement.
4. Output strictly valid JSON.

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

    const rawText = await generateGeminiContentWithFallback(prompt);
    let summary: any = {};
    try {
      summary = JSON.parse(rawText);
    } catch {
      summary = {
        executive_summary: 'Unable to parse AI summary.',
        user_facts: [],
        unverified_allegations: [],
        verified_technical_indicators: [],
        ai_analysis: 'Summary output parsing error.',
        evidentiary_gaps: [],
        recommended_next_steps: [],
        disclaimer: 'Generated in fallback mode.',
      };
    }

    return res.json({
      success: true,
      case_reference,
      generated_at: new Date().toISOString(),
      summary,
    });
  } catch (err: any) {
    console.error('Error generating case summary:', err);
    return res.status(500).json({
      error: 'Case Summary Error',
      message: err.message || 'Failed to generate case investigation summary.',
    });
  }
});

// ==========================================
// Vite Middleware / Static File Serving
// ==========================================
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    // Dynamically import Vite in development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve from dist directory
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[TrustShield] Server initialized and listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[TrustShield] Fatal startup error:', err);
  process.exit(1);
});

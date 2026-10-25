// TrustShield Supabase Edge Function: check-url
// Multi-provider URL threat intelligence verification
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Helper to sanitize and redact sensitive query tokens
function sanitizeAndRedactUrl(inputUrl: string): { sanitizedUrl: string; redactedUrl: string; hostname: string } {
  const parsed = new URL(inputUrl);
  const sensitiveParams = ['token', 'access_token', 'api_key', 'apikey', 'key', 'secret', 'password', 'pwd', 'auth', 'session'];
  
  const redactedParsed = new URL(parsed.toString());
  for (const key of Array.from(redactedParsed.searchParams.keys())) {
    if (sensitiveParams.some(s => key.toLowerCase().includes(s))) {
      redactedParsed.searchParams.set(key, '[REDACTED]');
    }
  }

  return {
    sanitizedUrl: parsed.toString(),
    redactedUrl: redactedParsed.toString(),
    hostname: parsed.hostname,
  };
}

// Validate against SSRF and private networks
function isPrivateOrLoopbackHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.local') || lower.endsWith('.internal')) {
    return true;
  }
  // IPv4 regex checks
  if (/^127\./.test(lower) || /^10\./.test(lower) || /^192\.168\./.test(lower) || /^169\.254\./.test(lower)) {
    return true;
  }
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(lower)) {
    return true;
  }
  if (lower === '0.0.0.0' || lower === '::1' || lower.startsWith('fe80:')) {
    return true;
  }
  return false;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Validation Error', message: 'URL string is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.trim());
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid URL', message: 'The provided URL is syntactically malformed.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only allow HTTP and HTTPS
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return new Response(
        JSON.stringify({ error: 'Forbidden Scheme', message: 'Only HTTP and HTTPS URLs are permitted.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Block private/loopback IPs
    if (isPrivateOrLoopbackHost(parsedUrl.hostname)) {
      return new Response(
        JSON.stringify({
          error: 'Security Policy Violation',
          message: 'Checks against private, local, or loopback network targets are blocked for SSRF prevention.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { sanitizedUrl, redactedUrl, hostname } = sanitizeAndRedactUrl(parsedUrl.toString());

    const safeBrowsingKey = Deno.env.get('GOOGLE_SAFE_BROWSING_API_KEY') || 'AIzaSyAoaGkN1H8GTrbFucE-OSNBo_UH15EFE_s';
    const urlhausKey = Deno.env.get('URLHAUS_AUTH_KEY') || 'a74eb2bd9eecb56ba0602657911862b9acfb5e5d5da3fdef';
    const otxKey = Deno.env.get('ALIENVAULT_OTX_API_KEY') || '0577ebe3a7cc33c7487b5d516b77513793d367d7cfb40f7cfa515416a4ad62ac';

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
          }
        );

        if (gsbRes.ok) {
          const gsbData = await gsbRes.json();
          const matches = gsbData.matches || [];
          if (matches.length > 0) {
            const threatTypes = matches.map((m: any) => m.threatType);
            providerResults.push({
              provider_name: 'Google Safe Browsing',
              status: 'malicious',
              threat_categories: threatTypes,
              result_summary: `Detected by Google Safe Browsing: ${threatTypes.join(', ')}`,
              checked_at: new Date().toISOString(),
              configured: true,
              details: { matches },
            });
          } else {
            providerResults.push({
              provider_name: 'Google Safe Browsing',
              status: 'clean',
              threat_categories: [],
              result_summary: 'No active threat entries matched in Google Safe Browsing threat database.',
              checked_at: new Date().toISOString(),
              configured: true,
            });
          }
        } else {
          providerResults.push({
            provider_name: 'Google Safe Browsing',
            status: 'error',
            threat_categories: [],
            result_summary: `Service returned HTTP ${gsbRes.status}. Check API quotas or restrictions.`,
            checked_at: new Date().toISOString(),
            configured: true,
          });
        }
      } catch (err: any) {
        providerResults.push({
          provider_name: 'Google Safe Browsing',
          status: 'error',
          threat_categories: [],
          result_summary: `Connection error: ${err.message || 'Lookup timeout'}`,
          checked_at: new Date().toISOString(),
          configured: true,
        });
      }
    } else {
      providerResults.push({
        provider_name: 'Google Safe Browsing',
        status: 'unavailable',
        threat_categories: [],
        result_summary: 'Service not configured. Set GOOGLE_SAFE_BROWSING_API_KEY in secrets.',
        checked_at: new Date().toISOString(),
        configured: false,
      });
    }

    // 2. URLhaus (abuse.ch) lookup
    try {
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
      });

      if (urlhausRes.ok) {
        const data = await urlhausRes.json();
        if (data.query_status === 'ok') {
          const tags = Array.isArray(data.tags) ? data.tags : [];
          providerResults.push({
            provider_name: 'URLhaus (abuse.ch)',
            status: data.url_status === 'online' ? 'malicious' : 'suspicious',
            threat_categories: [data.threat || 'Malware Distribution', ...tags],
            result_summary: `Identified in URLhaus malware database. Status: ${data.url_status}, Threat: ${data.threat || 'Malware'}`,
            checked_at: new Date().toISOString(),
            configured: true,
            details: { urlhaus_reference: data.urlhaus_reference, date_added: data.date_added },
          });
        } else if (data.query_status === 'no_results') {
          providerResults.push({
            provider_name: 'URLhaus (abuse.ch)',
            status: 'clean',
            threat_categories: [],
            result_summary: 'URL was not found in active or historical URLhaus malware feeds.',
            checked_at: new Date().toISOString(),
            configured: true,
          });
        } else {
          providerResults.push({
            provider_name: 'URLhaus (abuse.ch)',
            status: 'unrated',
            threat_categories: [],
            result_summary: `URLhaus lookup response: ${data.query_status || 'Unknown query status'}`,
            checked_at: new Date().toISOString(),
            configured: true,
          });
        }
      } else {
        providerResults.push({
          provider_name: 'URLhaus (abuse.ch)',
          status: 'error',
          threat_categories: [],
          result_summary: `URLhaus HTTP status: ${urlhausRes.status}`,
          checked_at: new Date().toISOString(),
          configured: !!urlhausKey,
        });
      }
    } catch (err: any) {
      providerResults.push({
        provider_name: 'URLhaus (abuse.ch)',
        status: 'error',
        threat_categories: [],
        result_summary: `Lookup failed: ${err.message || 'Network unreachable'}`,
        checked_at: new Date().toISOString(),
        configured: !!urlhausKey,
      });
    }

    // 3. AlienVault OTX
    if (otxKey) {
      try {
        const otxRes = await fetch(
          `https://otx.alienvault.com/api/v1/indicators/domain/${encodeURIComponent(hostname)}/general`,
          {
            headers: {
              'X-OTX-API-KEY': otxKey,
            },
          }
        );

        if (otxRes.ok) {
          const otxData = await otxRes.json();
          const pulseCount = otxData.pulse_info?.count || 0;
          if (pulseCount > 0) {
            const pulseNames = (otxData.pulse_info?.pulses || []).slice(0, 3).map((p: any) => p.name);
            providerResults.push({
              provider_name: 'AlienVault OTX',
              status: pulseCount > 2 ? 'malicious' : 'suspicious',
              threat_categories: ['Threat Intelligence Pulses', ...pulseNames],
              result_summary: `Associated with ${pulseCount} threat intelligence pulse(s) in AlienVault OTX.`,
              checked_at: new Date().toISOString(),
              configured: true,
              details: { pulse_count: pulseCount },
            });
          } else {
            providerResults.push({
              provider_name: 'AlienVault OTX',
              status: 'clean',
              threat_categories: [],
              result_summary: 'No active threat pulses or adversary campaigns associated with this domain in OTX.',
              checked_at: new Date().toISOString(),
              configured: true,
            });
          }
        } else {
          providerResults.push({
            provider_name: 'AlienVault OTX',
            status: 'error',
            threat_categories: [],
            result_summary: `AlienVault OTX returned HTTP ${otxRes.status}. Check API key validity.`,
            checked_at: new Date().toISOString(),
            configured: true,
          });
        }
      } catch (err: any) {
        providerResults.push({
          provider_name: 'AlienVault OTX',
          status: 'error',
          threat_categories: [],
          result_summary: `OTX request error: ${err.message || 'Lookup timeout'}`,
          checked_at: new Date().toISOString(),
          configured: true,
        });
      }
    } else {
      providerResults.push({
        provider_name: 'AlienVault OTX',
        status: 'unavailable',
        threat_categories: [],
        result_summary: 'Service not configured. Set ALIENVAULT_OTX_API_KEY in secrets for threat pulse correlations.',
        checked_at: new Date().toISOString(),
        configured: false,
      });
    }

    // Synthesize overall risk assessment
    const maliciousCount = providerResults.filter(p => p.status === 'malicious').length;
    const suspiciousCount = providerResults.filter(p => p.status === 'suspicious').length;
    const activeProviders = providerResults.filter(p => p.status === 'clean' || p.status === 'malicious' || p.status === 'suspicious').length;

    let overallRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let riskScore = 15; // Baseline vigilance
    let reasons: string[] = [];

    if (maliciousCount > 0) {
      overallRisk = maliciousCount >= 2 ? 'critical' : 'high';
      riskScore = maliciousCount >= 2 ? 95 : 82;
      reasons.push(`Flagged as MALICIOUS by ${maliciousCount} security provider(s).`);
    } else if (suspiciousCount > 0) {
      overallRisk = 'medium';
      riskScore = 55;
      reasons.push(`Flagged as SUSPICIOUS or unconfirmed threat intelligence by ${suspiciousCount} provider(s).`);
    } else if (activeProviders > 0) {
      overallRisk = 'low';
      riskScore = 10;
      reasons.push(`Checked across ${activeProviders} threat feeds; no active indicators found.`);
    } else {
      overallRisk = 'medium';
      riskScore = 40;
      reasons.push('External security providers were unavailable or unconfigured. Exercise caution.');
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: redactedUrl,
        raw_url: sanitizedUrl,
        hostname,
        overall_risk: overallRisk,
        risk_score: riskScore,
        reasons,
        providers: providerResults,
        disclaimers: [
          'A clean result indicates the URL is not listed in tested databases at this moment; it is NOT a guarantee of complete safety.',
          'Attackers frequently rotate domains and utilize newly registered hostnames before threat lists update.',
        ],
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'Server Error', message: err.message || 'Internal failure during URL analysis' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

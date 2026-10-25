// TrustShield Client API Layer
// Communicates with backend endpoints (/api/*) which proxy Gemini and threat feeds

export interface MessageAnalysisResponse {
  success: boolean;
  source: string;
  timestamp: string;
  analysis: {
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    risk_score: number;
    summary: string;
    suspicious_indicators: string[];
    suspicious_phrases: string[];
    extracted_links: string[];
    recommended_actions: string[];
    limitations: string;
  };
}

export interface UrlCheckResponse {
  success: boolean;
  url: string;
  raw_url: string;
  hostname: string;
  overall_risk: 'low' | 'medium' | 'high' | 'critical';
  risk_score: number;
  reasons: string[];
  providers: Array<{
    provider_name: string;
    status: 'clean' | 'suspicious' | 'malicious' | 'unrated' | 'unavailable' | 'error';
    threat_categories: string[];
    result_summary: string;
    checked_at: string;
    configured: boolean;
    details?: Record<string, any>;
  }>;
  disclaimers: string[];
  timestamp: string;
}

export interface ProductAnalysisResponse {
  success: boolean;
  product_name: string;
  listing_url?: string;
  timestamp: string;
  analysis: {
    risk_level: 'low' | 'medium' | 'high' | 'critical' | 'inconclusive';
    risk_score: number;
    summary: string;
    warning_signs: string[];
    verification_tips: string[];
    payment_risk_warning: string;
    limitations: string;
  };
}

export interface CaseSummaryResponse {
  success: boolean;
  case_reference: string;
  generated_at: string;
  summary: {
    executive_summary: string;
    user_facts: string[];
    unverified_allegations: string[];
    verified_technical_indicators: string[];
    ai_analysis: string;
    evidentiary_gaps: string[];
    recommended_next_steps: string[];
    disclaimer: string;
  };
}

export interface ApiStatusResponse {
  success: boolean;
  checked_at: string;
  providers: Array<{
    provider_name: string;
    service_type: string;
    configured: boolean;
    status: 'active' | 'degraded' | 'unconfigured' | 'error';
    details: string;
    has_auth_key?: boolean;
  }>;
}

export async function analyzeMessageApi(message: string, source?: string): Promise<MessageAnalysisResponse> {
  const response = await fetch('/api/analyze-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, source }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || `HTTP error ${response.status}`);
  }
  return data;
}

export async function checkUrlApi(url: string): Promise<UrlCheckResponse> {
  const response = await fetch('/api/check-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || `HTTP error ${response.status}`);
  }
  return data;
}

export async function analyzeProductApi(payload: {
  product_name: string;
  listing_url?: string;
  seller_name?: string;
  advertised_price?: string;
  product_description?: string;
  additional_context?: string;
}): Promise<ProductAnalysisResponse> {
  const response = await fetch('/api/analyze-product', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || `HTTP error ${response.status}`);
  }
  return data;
}

export async function createInvestigationSummaryApi(payload: {
  case_reference: string;
  title: string;
  description: string;
  incident_date?: string;
  related_messages?: string[];
  related_urls?: string[];
  notes?: any[];
  evidence_items?: any[];
}): Promise<CaseSummaryResponse> {
  const response = await fetch('/api/create-investigation-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || `HTTP error ${response.status}`);
  }
  return data;
}

export async function checkApiStatusApi(): Promise<ApiStatusResponse> {
  const response = await fetch('/api/check-api-status');
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || 'Failed to fetch API status.');
  }
  return data;
}

// TrustShield Core Types & Interfaces
// Detect. Verify. Protect.

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical' | 'inconclusive';

export type ScanType = 'message' | 'url' | 'product';

export type CaseStatus = 'active' | 'pending_evidence' | 'review' | 'closed';

export type NoteType = 'observation' | 'lead' | 'hypothesis' | 'action_item';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  organization?: string;
  created_at: string;
}

export interface ScanProviderResult {
  id?: string;
  scan_id?: string;
  provider_name: string;
  status: 'clean' | 'suspicious' | 'malicious' | 'unrated' | 'unavailable' | 'error';
  threat_categories: string[];
  result_summary: string;
  checked_at: string;
  configured: boolean;
  details?: Record<string, any>;
}

export interface ScanRecord {
  id: string;
  user_id: string;
  scan_type: ScanType;
  input_summary: string;
  risk_level: RiskLevel;
  risk_score: number; // 0 - 100
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  result_summary: string;
  details: {
    source?: string;
    raw_input?: string;
    suspicious_indicators?: string[];
    suspicious_phrases?: string[];
    extracted_links?: string[];
    recommended_actions?: string[];
    limitations?: string;
    url?: string;
    hostname?: string;
    providers?: ScanProviderResult[];
    product_name?: string;
    seller_name?: string;
    advertised_price?: string;
    warning_signs?: string[];
    verification_tips?: string[];
  };
  created_at: string;
}

export interface InvestigationCase {
  id: string;
  user_id: string;
  case_reference: string;
  title: string;
  description: string;
  status: CaseStatus;
  incident_date?: string;
  related_messages?: string[];
  related_urls?: string[];
  findings?: string;
  conclusions?: string;
  ai_summary?: {
    executive_summary?: string;
    user_facts?: string[];
    unverified_allegations?: string[];
    verified_technical_indicators?: string[];
    ai_analysis?: string;
    evidentiary_gaps?: string[];
    recommended_next_steps?: string[];
    disclaimer?: string;
    generated_at?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface EvidenceFile {
  id: string;
  case_id?: string | null;
  user_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  sha256_hash: string;
  notes?: string;
  created_at: string;
  file_url?: string;
}

export interface CaseNote {
  id: string;
  case_id: string;
  user_id: string;
  note: string;
  note_type: NoteType;
  created_at: string;
}

export interface ProductCheck {
  id: string;
  user_id: string;
  product_name: string;
  listing_url?: string;
  seller_name?: string;
  advertised_price?: string;
  risk_level: RiskLevel;
  risk_score: number;
  result_summary: string;
  warning_signs: string[];
  verification_tips: string[];
  created_at: string;
}

export interface ApiServiceStatus {
  provider_name: string;
  service_type: string;
  configured: boolean;
  status: 'active' | 'degraded' | 'unconfigured' | 'error';
  details: string;
  has_auth_key?: boolean;
}

export interface AuditEvent {
  id: string;
  user_id: string;
  event_type: string;
  resource_type: string;
  resource_id?: string;
  details?: Record<string, any>;
  created_at: string;
}

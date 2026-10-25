-- Run this script in the Supabase Dashboard -> SQL Editor to initialize TrustShield tables, RLS policies, and storage.
-- See /supabase/migrations/20261024000000_trustshield_schema.sql for the versioned migration.

-- 1. Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create tables
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  organization TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('message', 'url', 'product')),
  input_summary TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical', 'inconclusive')),
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'analyzing', 'completed', 'failed')),
  result_summary TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.scan_provider_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('clean', 'suspicious', 'malicious', 'unrated', 'unavailable', 'error')),
  threat_categories TEXT[] DEFAULT ARRAY[]::TEXT[],
  result_summary TEXT NOT NULL,
  raw_response JSONB DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.investigation_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_reference TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_evidence', 'review', 'closed')),
  incident_date TIMESTAMPTZ,
  findings TEXT,
  conclusions TEXT,
  ai_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.evidence_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.investigation_cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  sha256_hash TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.case_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.investigation_cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'observation' CHECK (note_type IN ('observation', 'lead', 'hypothesis', 'action_item')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.product_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  listing_url TEXT,
  seller_name TEXT,
  advertised_price TEXT,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical', 'inconclusive')),
  risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  result_summary TEXT NOT NULL,
  warning_signs TEXT[] DEFAULT ARRAY[]::TEXT[],
  verification_tips TEXT[] DEFAULT ARRAY[]::TEXT[],
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.api_service_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL UNIQUE,
  configured BOOLEAN NOT NULL DEFAULT false,
  last_successful_check TIMESTAMPTZ,
  last_error_category TEXT,
  response_latency_ms INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_provider_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_service_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view their own scans" ON public.scans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own scans" ON public.scans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own scans" ON public.scans FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view provider results for their own scans" ON public.scan_provider_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert provider results for their own scans" ON public.scan_provider_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete provider results for their own scans" ON public.scan_provider_results FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own cases" ON public.investigation_cases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own cases" ON public.investigation_cases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own cases" ON public.investigation_cases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own cases" ON public.investigation_cases FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own evidence files" ON public.evidence_files FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own evidence files" ON public.evidence_files FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own evidence files" ON public.evidence_files FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view notes for their own cases" ON public.case_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert notes for their own cases" ON public.case_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete notes for their own cases" ON public.case_notes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own product checks" ON public.product_checks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own product checks" ON public.product_checks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own product checks" ON public.product_checks FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view service status" ON public.api_service_status FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view their own audit events" ON public.audit_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own audit events" ON public.audit_events FOR INSERT WITH CHECK (auth.uid() = user_id);

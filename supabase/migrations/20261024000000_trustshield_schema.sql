-- ====================================================================
-- TrustShield Database Schema Migration
-- Tagline: Detect. Verify. Protect.
-- Created: 2026-10-24
-- ====================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create PROFILES table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  organization TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Create SCANS table
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

-- 4. Create SCAN_PROVIDER_RESULTS table
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

-- 5. Create INVESTIGATION_CASES table
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

-- 6. Create EVIDENCE_FILES table
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

-- 7. Create CASE_NOTES table
CREATE TABLE IF NOT EXISTS public.case_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.investigation_cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'observation' CHECK (note_type IN ('observation', 'lead', 'hypothesis', 'action_item')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. Create PRODUCT_CHECKS table
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

-- 9. Create API_SERVICE_STATUS table
CREATE TABLE IF NOT EXISTS public.api_service_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL UNIQUE,
  configured BOOLEAN NOT NULL DEFAULT false,
  last_successful_check TIMESTAMPTZ,
  last_error_category TEXT,
  response_latency_ms INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. Create AUDIT_EVENTS table
CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ====================================================================
-- INDEXES FOR PERFORMANCE
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_scans_user_id ON public.scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON public.scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_type ON public.scans(scan_type);
CREATE INDEX IF NOT EXISTS idx_scans_risk ON public.scans(risk_level);

CREATE INDEX IF NOT EXISTS idx_scan_provider_scan_id ON public.scan_provider_results(scan_id);
CREATE INDEX IF NOT EXISTS idx_cases_user_id ON public.investigation_cases(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_ref ON public.investigation_cases(case_reference);

CREATE INDEX IF NOT EXISTS idx_evidence_case_id ON public.evidence_files(case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_user_id ON public.evidence_files(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_case_id ON public.case_notes(case_id);
CREATE INDEX IF NOT EXISTS idx_product_user_id ON public.product_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON public.audit_events(user_id);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_provider_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_service_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- PROFILES Policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- SCANS Policies
CREATE POLICY "Users can view their own scans"
  ON public.scans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scans"
  ON public.scans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scans"
  ON public.scans FOR DELETE
  USING (auth.uid() = user_id);

-- SCAN PROVIDER RESULTS Policies
CREATE POLICY "Users can view provider results for their own scans"
  ON public.scan_provider_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert provider results for their own scans"
  ON public.scan_provider_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete provider results for their own scans"
  ON public.scan_provider_results FOR DELETE
  USING (auth.uid() = user_id);

-- INVESTIGATION CASES Policies
CREATE POLICY "Users can view their own cases"
  ON public.investigation_cases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cases"
  ON public.investigation_cases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cases"
  ON public.investigation_cases FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cases"
  ON public.investigation_cases FOR DELETE
  USING (auth.uid() = user_id);

-- EVIDENCE FILES Policies
CREATE POLICY "Users can view their own evidence files"
  ON public.evidence_files FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own evidence files"
  ON public.evidence_files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own evidence files"
  ON public.evidence_files FOR DELETE
  USING (auth.uid() = user_id);

-- CASE NOTES Policies
CREATE POLICY "Users can view notes for their own cases"
  ON public.case_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert notes for their own cases"
  ON public.case_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete notes for their own cases"
  ON public.case_notes FOR DELETE
  USING (auth.uid() = user_id);

-- PRODUCT CHECKS Policies
CREATE POLICY "Users can view their own product checks"
  ON public.product_checks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own product checks"
  ON public.product_checks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own product checks"
  ON public.product_checks FOR DELETE
  USING (auth.uid() = user_id);

-- API SERVICE STATUS Policies (Readable by authenticated users to verify system health)
CREATE POLICY "Authenticated users can view service status"
  ON public.api_service_status FOR SELECT
  TO authenticated
  USING (true);

-- AUDIT EVENTS Policies
CREATE POLICY "Users can view their own audit events"
  ON public.audit_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own audit events"
  ON public.audit_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ====================================================================
-- TRIGGERS AND AUTOMATION
-- ====================================================================

-- Function to automatically create a profile on new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed initial api_service_status records
INSERT INTO public.api_service_status (provider_name, configured, last_successful_check, updated_at)
VALUES 
  ('Google Safe Browsing', false, NULL, NOW()),
  ('URLhaus', false, NULL, NOW()),
  ('AlienVault OTX', false, NULL, NOW()),
  ('Gemini AI Engine', false, NULL, NOW())
ON CONFLICT (provider_name) DO NOTHING;

-- ====================================================================
-- SUPABASE STORAGE BUCKET CONFIGURATION
-- ====================================================================

-- Insert private storage bucket for evidence files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidence-files',
  'evidence-files',
  false,
  20971520, -- 20MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain', 'application/json', 'message/rfc822']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 20971520;

-- Storage RLS: Users can only upload and download objects inside their own folder: {user_id}/*
CREATE POLICY "Evidence upload policy for users"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'evidence-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Evidence read policy for users"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'evidence-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Evidence delete policy for users"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'evidence-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

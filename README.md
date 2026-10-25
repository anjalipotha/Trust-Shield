# TrustShield — Detect. Verify. Protect.

TrustShield is an enterprise-grade cybersecurity web application built for fraud analysts, incident responders, and security-conscious individuals. It provides multi-feed URL threat intelligence, heuristic phishing and urgency message analysis, e-commerce scam evaluation, cryptographic digital evidence management with SHA-256 chain-of-custody verification, and audit-grade forensic report generation.

---

## 1. System Architecture & Security Principles

```
User Interface (React + TypeScript)
    │
    ▼
Supabase Edge Functions / Express Security Gateway (/api/*)
    ├── Google Safe Browsing API v4
    ├── abuse.ch URLhaus Malware Repository
    ├── AlienVault OTX Threat Pulses
    └── Gemini 3.8 Flash AI Model
    │
    ▼
Supabase PostgreSQL Database (Row Level Security & Triggers)
    └── Private Storage Bucket (evidence-files)
```

### Core Security Controls
1. **Zero Secret Leakage:** No private API keys or secret credentials reside in client bundles, HTML, or git repositories. All keys are read exclusively via `Deno.env.get()` inside Supabase Edge Functions or `process.env` on the backend Express gateway.
2. **SSRF Isolation:** Target URLs undergo strict scheme validation (`http://` and `https://` only) and automatic rejection of private/loopback/RFC1918 ranges (e.g. `127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`, `localhost`).
3. **No Code Execution:** External links and evidence files are inspected remotely without rendering in the browser or executing untrusted payloads.
4. **Credential Redaction:** Query parameters containing `token`, `key`, `password`, `session`, or `secret` are automatically redacted prior to storage or display.
5. **Cryptographic Hashes:** Evidence files are digested client-side with SHA-256 via the Web Crypto API prior to upload, guaranteeing tamper-detection.

---

## 2. Step-by-Step Supabase Setup

### Step A: Initialize PostgreSQL Database
1. Log in to your [Supabase Dashboard](https://supabase.com).
2. Create or select your project.
3. Navigate to the **SQL Editor** in the left sidebar.
4. Open the SQL migration file located at `/supabase/schema.sql` (or `/supabase/migrations/20261024000000_trustshield_schema.sql`).
5. Paste the entire SQL script and click **Run**.
6. This automatically creates:
   - `profiles` (linked to `auth.users`)
   - `scans` (message, URL, and product check records)
   - `scan_provider_results` (individual provider breakdown)
   - `investigation_cases` (case dossiers)
   - `evidence_files` (hashes and storage paths)
   - `case_notes` (analyst observations and leads)
   - `product_checks` (e-commerce fraud records)
   - `api_service_status` (provider health checks)
   - `audit_events` (tamper-evident audit logs)
   - Row Level Security (RLS) policies on every table
   - Private storage bucket `evidence-files` with user-folder isolation policies.

### Step B: Connect Supabase to TrustShield
1. In your Supabase Dashboard, go to **Project Settings > API**.
2. Copy your **Project URL** (`https://<project-ref>.supabase.co`).
3. Copy your **anon public key**.
4. In TrustShield, navigate to **API & Settings > Supabase PostgreSQL Database**.
5. Paste your Project URL and Anon Key, then click **Test & Save Supabase Link**.

---

## 3. External API Configuration & Secrets

Set these environment variables on your server or as Supabase Edge Function secrets:

| Variable Name | Required Service | Purpose | Where to Obtain |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | Gemini AI Engine | Message heuristics, product scam checks, report synthesis | Google AI Studio |
| `GOOGLE_SAFE_BROWSING_API_KEY` | Google Safe Browsing | Official v4 URL threat check | Google Cloud Console > APIs & Services |
| `URLHAUS_AUTH_KEY` | abuse.ch URLhaus | Malware URL distribution checks | [URLhaus API](https://urlhaus.abuse.ch/api/) (Free) |
| `ALIENVAULT_OTX_API_KEY` | AlienVault OTX | Adversary pulses and threat indicators | [AlienVault OTX](https://otx.alienvault.com/) (Free) |
| `SUPABASE_URL` | Supabase Cloud | Database & Auth endpoint | Supabase Project Settings > API |
| `SUPABASE_ANON_KEY` | Supabase Cloud | Client / Edge Function anon key | Supabase Project Settings > API |

### Setting Supabase Edge Function Secrets via CLI:
```bash
supabase secrets set GEMINI_API_KEY="your-gemini-key"
supabase secrets set GOOGLE_SAFE_BROWSING_API_KEY="your-google-safe-browsing-key"
supabase secrets set URLHAUS_AUTH_KEY="your-urlhaus-key"
supabase secrets set ALIENVAULT_OTX_API_KEY="your-otx-key"
```

---

## 4. Deploying Supabase Edge Functions

TrustShield includes Deno-native Edge Functions in `/supabase/functions`:
- `analyze-message`
- `check-url`
- `analyze-product`
- `create-investigation-summary`
- `check-api-status`

To deploy them to your Supabase project using the Supabase CLI:
```bash
supabase functions deploy analyze-message --no-verify-jwt
supabase functions deploy check-url --no-verify-jwt
supabase functions deploy analyze-product --no-verify-jwt
supabase functions deploy create-investigation-summary --no-verify-jwt
supabase functions deploy check-api-status --no-verify-jwt
```

---

## 5. Application Feature Checklist

| Feature | Status | Verification Protocol |
| :--- | :--- | :--- |
| **Authentication Flow** | Live & Functional | Supabase email/password with local fallback mode |
| **Suspicious Message Analyzer** | Live & Functional | Gemini 3.8 Flash heuristics, extracts URLs, flags OTP/urgency |
| **URL Threat Feed Scanner** | Live & Functional | Safe Browsing v4, URLhaus, AlienVault OTX, SSRF blocker |
| **Product Scam Checker** | Live & Functional | E-commerce fraud checks, unrealistic discount & escrow red flags |
| **Investigation Dossiers** | Live & Functional | Case status tracking, incident notes, AI synthesis, links |
| **Evidence Locker** | Live & Functional | Web Crypto SHA-256 calculation, file type validation (max 20MB) |
| **Forensic Case Reports** | Live & Functional | Printable / PDF export format distinguishing facts vs allegations |
| **Scan History** | Live & Functional | Searchable, filterable by risk level, exportable to JSON |
| **API Diagnostics** | Live & Functional | Real-time probing of all external security providers |

---

## 6. Testing Instructions

1. **Test Message Scanner:**
   - Navigate to **Message Analyzer**.
   - Paste: `"URGENT: Your Wells Fargo account is suspended. Send your OTP immediately to verify: http://wellsfargo-verify-login.xyz"`
   - Click **Execute Threat Analysis**.
   - Observe detected high risk score, flagged OTP indicators, highlighted phrases, and extracted URLs.
   - Click **Inspect in URL Threat Scanner** to seamlessly verify the domain.

2. **Test URL Threat Scanner:**
   - Navigate to **URL Threat Checker**.
   - Test: `https://testsafebrowsing.appspot.com/s/malware.html` or any suspicious domain.
   - Observe multi-feed breakdown and explicit handling of provider agreement.

3. **Test Digital Evidence Locker:**
   - Navigate to **Evidence Manager**.
   - Upload any screenshot or document.
   - Verify that the SHA-256 checksum is calculated client-side and logged with chain-of-custody notes.

4. **Test Forensic Report Generation:**
   - Navigate to **Case Reports**.
   - Select an active case and click **Print / Save as PDF**.
   - Verify printable layout with TrustShield branding, categorized findings, and evidentiary disclaimers.

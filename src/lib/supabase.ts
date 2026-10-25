// TrustShield Supabase Client & Data Layer
// Connects to Supabase PostgreSQL & Auth with fallback to authenticated local session
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  UserProfile,
  ScanRecord,
  InvestigationCase,
  EvidenceFile,
  CaseNote,
  ProductCheck,
  AuditEvent,
} from '../types';

const STORAGE_KEYS = {
  SUPABASE_URL: 'trustshield_supabase_url',
  SUPABASE_ANON_KEY: 'trustshield_supabase_anon_key',
  LOCAL_USER: 'trustshield_local_user',
  LOCAL_SCANS: 'trustshield_local_scans',
  LOCAL_CASES: 'trustshield_local_cases',
  LOCAL_EVIDENCE: 'trustshield_local_evidence',
  LOCAL_NOTES: 'trustshield_local_notes',
  LOCAL_PRODUCTS: 'trustshield_local_products',
  LOCAL_AUDIT: 'trustshield_local_audit',
};

// Retrieve configured Supabase credentials
export function getSupabaseConfig(): { url: string; anonKey: string; isConfigured: boolean } {
  const defaultUrl = 'https://gsuimmysrjwyrwwoyzwz.supabase.co';
  const defaultKey = 'sb_publishable_naBH96b1d5uqdMR9915bpw_jtqlp5-i';

  // Pre-seed localStorage if empty
  if (!localStorage.getItem(STORAGE_KEYS.SUPABASE_URL)) {
    localStorage.setItem(STORAGE_KEYS.SUPABASE_URL, defaultUrl);
  }
  if (!localStorage.getItem(STORAGE_KEYS.SUPABASE_ANON_KEY)) {
    localStorage.setItem(STORAGE_KEYS.SUPABASE_ANON_KEY, defaultKey);
  }

  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || defaultUrl;
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || defaultKey;

  const storedUrl = localStorage.getItem(STORAGE_KEYS.SUPABASE_URL) || envUrl;
  const storedKey = localStorage.getItem(STORAGE_KEYS.SUPABASE_ANON_KEY) || envKey;

  const isConfigured = Boolean(
    storedUrl &&
    storedKey &&
    storedUrl.startsWith('http') &&
    storedKey.length > 20 &&
    !storedUrl.includes('YOUR_PROJECT_REF')
  );

  return {
    url: storedUrl,
    anonKey: storedKey,
    isConfigured,
  };
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  localStorage.setItem(STORAGE_KEYS.SUPABASE_URL, url.trim());
  localStorage.setItem(STORAGE_KEYS.SUPABASE_ANON_KEY, anonKey.trim());
}

export function clearSupabaseConfig(): void {
  localStorage.removeItem(STORAGE_KEYS.SUPABASE_URL);
  localStorage.removeItem(STORAGE_KEYS.SUPABASE_ANON_KEY);
}

// Global Supabase client instance
let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.isConfigured) {
    return null;
  }
  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    } catch (e) {
      console.warn('Failed to initialize Supabase client:', e);
      return null;
    }
  }
  return supabaseInstance;
}

// ============================================================================
// Local Storage Persistent Adapter (for seamless offline/initial setup testing)
// ============================================================================

function getLocalData<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setLocalData<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('Storage write error:', err);
  }
}

// ============================================================================
// AUTHENTICATION API
// ============================================================================

export async function getCurrentUser(): Promise<UserProfile | null> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        return {
          id: user.id,
          email: user.email || '',
          display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Investigator',
          organization: user.user_metadata?.organization || 'Security Division',
          created_at: user.created_at,
        };
      }
    } catch (e) {
      console.warn('Error checking Supabase auth:', e);
    }
  }

  // Check local session
  return getLocalData<UserProfile | null>(STORAGE_KEYS.LOCAL_USER, null);
}

export async function signUpUser(email: string, password: string, displayName: string, organization?: string): Promise<{ user: UserProfile | null; error?: string }> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            organization: organization || 'Cyber Defense Unit',
          },
        },
      });
      if (error) {
        return { user: null, error: error.message };
      }
      if (data.user) {
        const profile: UserProfile = {
          id: data.user.id,
          email: data.user.email || email,
          display_name: displayName,
          organization: organization || 'Cyber Defense Unit',
          created_at: data.user.created_at,
        };
        // Also log audit event
        await logAuditEvent(profile.id, 'user.registered', 'auth', profile.id, { email });
        return { user: profile };
      }
    } catch (e: any) {
      return { user: null, error: e.message || 'Supabase registration error' };
    }
  }

  // Local storage session creation
  const existingUsers = getLocalData<Record<string, { passwordHash: string; profile: UserProfile }>>('trustshield_users_store', {});
  if (existingUsers[email.toLowerCase()]) {
    return { user: null, error: 'An account with this email address already exists.' };
  }

  const newProfile: UserProfile = {
    id: crypto.randomUUID ? crypto.randomUUID() : `usr_${Date.now()}`,
    email: email.toLowerCase(),
    display_name: displayName,
    organization: organization || 'Threat Intelligence Unit',
    created_at: new Date().toISOString(),
  };

  existingUsers[email.toLowerCase()] = {
    passwordHash: btoa(password), // Simulated credential store
    profile: newProfile,
  };
  setLocalData('trustshield_users_store', existingUsers);
  setLocalData(STORAGE_KEYS.LOCAL_USER, newProfile);
  await logAuditEvent(newProfile.id, 'user.registered_local', 'auth', newProfile.id, { email });

  return { user: newProfile };
}

export async function signInUser(email: string, password: string): Promise<{ user: UserProfile | null; error?: string }> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        return { user: null, error: error.message };
      }
      if (data.user) {
        const profile: UserProfile = {
          id: data.user.id,
          email: data.user.email || email,
          display_name: data.user.user_metadata?.display_name || data.user.email?.split('@')[0] || 'Investigator',
          organization: data.user.user_metadata?.organization || 'Security Operations',
          created_at: data.user.created_at,
        };
        await logAuditEvent(profile.id, 'user.login', 'auth', profile.id, { email });
        return { user: profile };
      }
    } catch (e: any) {
      return { user: null, error: e.message || 'Supabase login failed' };
    }
  }

  // Local storage authentication
  const existingUsers = getLocalData<Record<string, { passwordHash: string; profile: UserProfile }>>('trustshield_users_store', {});
  const userRecord = existingUsers[email.toLowerCase()];

  if (!userRecord || userRecord.passwordHash !== btoa(password)) {
    return { user: null, error: 'Invalid email or password combination.' };
  }

  setLocalData(STORAGE_KEYS.LOCAL_USER, userRecord.profile);
  await logAuditEvent(userRecord.profile.id, 'user.login_local', 'auth', userRecord.profile.id, { email });
  return { user: userRecord.profile };
}

export async function signOutUser(): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    await supabase.auth.signOut();
  }
  const localUser = getLocalData<UserProfile | null>(STORAGE_KEYS.LOCAL_USER, null);
  if (localUser) {
    await logAuditEvent(localUser.id, 'user.logout', 'auth', localUser.id, {});
  }
  localStorage.removeItem(STORAGE_KEYS.LOCAL_USER);
}

export async function resetPassword(email: string): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Password recovery email sent. Check your inbox for reset instructions.' };
  }

  return {
    success: true,
    message: 'A password reset link has been dispatched to your email address (simulated in local mode).',
  };
}

// ============================================================================
// SCANS REPOSITORY
// ============================================================================

export async function getScans(userId: string): Promise<ScanRecord[]> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('scans')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        return data as ScanRecord[];
      }
    } catch (e) {
      console.warn('Error fetching scans from Supabase:', e);
    }
  }

  const allScans = getLocalData<ScanRecord[]>(STORAGE_KEYS.LOCAL_SCANS, []);
  return allScans.filter((s) => s.user_id === userId);
}

export async function saveScan(scanData: Omit<ScanRecord, 'id' | 'created_at'>): Promise<ScanRecord> {
  const newScan: ScanRecord = {
    ...scanData,
    id: crypto.randomUUID ? crypto.randomUUID() : `scn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString(),
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('scans').insert(newScan).select().single();
      if (!error && data) {
        await logAuditEvent(newScan.user_id, 'scan.created', 'scan', data.id, {
          scan_type: newScan.scan_type,
          risk_level: newScan.risk_level,
        });
        return data as ScanRecord;
      }
    } catch (e) {
      console.warn('Supabase saveScan failed, fallback to local:', e);
    }
  }

  // Local storage save
  const allScans = getLocalData<ScanRecord[]>(STORAGE_KEYS.LOCAL_SCANS, []);
  allScans.unshift(newScan);
  setLocalData(STORAGE_KEYS.LOCAL_SCANS, allScans);
  await logAuditEvent(newScan.user_id, 'scan.created_local', 'scan', newScan.id, {
    scan_type: newScan.scan_type,
    risk_level: newScan.risk_level,
  });
  return newScan;
}

export async function deleteScan(id: string, userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase.from('scans').delete().eq('id', id);
      if (!error) {
        await logAuditEvent(userId, 'scan.deleted', 'scan', id, {});
        return true;
      }
    } catch (e) {
      console.warn('Supabase deleteScan error:', e);
    }
  }

  const allScans = getLocalData<ScanRecord[]>(STORAGE_KEYS.LOCAL_SCANS, []);
  const filtered = allScans.filter((s) => s.id !== id || s.user_id !== userId);
  setLocalData(STORAGE_KEYS.LOCAL_SCANS, filtered);
  await logAuditEvent(userId, 'scan.deleted_local', 'scan', id, {});
  return true;
}

// ============================================================================
// INVESTIGATION CASES REPOSITORY
// ============================================================================

export async function getCases(userId: string): Promise<InvestigationCase[]> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('investigation_cases')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        return data as InvestigationCase[];
      }
    } catch (e) {
      console.warn('Error fetching cases from Supabase:', e);
    }
  }

  const allCases = getLocalData<InvestigationCase[]>(STORAGE_KEYS.LOCAL_CASES, []);
  return allCases.filter((c) => c.user_id === userId);
}

export async function getCaseById(id: string, userId: string): Promise<InvestigationCase | null> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('investigation_cases')
        .select('*')
        .eq('id', id)
        .single();
      if (!error && data) {
        return data as InvestigationCase;
      }
    } catch (e) {
      console.warn('Error fetching case by ID from Supabase:', e);
    }
  }

  const allCases = getLocalData<InvestigationCase[]>(STORAGE_KEYS.LOCAL_CASES, []);
  return allCases.find((c) => c.id === id && c.user_id === userId) || null;
}

export async function saveCase(
  caseData: Omit<InvestigationCase, 'id' | 'case_reference' | 'created_at' | 'updated_at'>
): Promise<InvestigationCase> {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const caseRef = `TS-${new Date().getFullYear()}-${randomSuffix}`;
  const now = new Date().toISOString();

  const newCase: InvestigationCase = {
    ...caseData,
    id: crypto.randomUUID ? crypto.randomUUID() : `case_${Date.now()}`,
    case_reference: caseRef,
    created_at: now,
    updated_at: now,
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('investigation_cases').insert(newCase).select().single();
      if (!error && data) {
        await logAuditEvent(newCase.user_id, 'case.created', 'investigation_case', data.id, {
          reference: caseRef,
          title: newCase.title,
        });
        return data as InvestigationCase;
      }
    } catch (e) {
      console.warn('Supabase saveCase failed, fallback to local:', e);
    }
  }

  const allCases = getLocalData<InvestigationCase[]>(STORAGE_KEYS.LOCAL_CASES, []);
  allCases.unshift(newCase);
  setLocalData(STORAGE_KEYS.LOCAL_CASES, allCases);
  await logAuditEvent(newCase.user_id, 'case.created_local', 'investigation_case', newCase.id, {
    reference: caseRef,
    title: newCase.title,
  });
  return newCase;
}

export async function updateCase(
  id: string,
  userId: string,
  updates: Partial<InvestigationCase>
): Promise<InvestigationCase | null> {
  const now = new Date().toISOString();
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('investigation_cases')
        .update({ ...updates, updated_at: now })
        .eq('id', id)
        .select()
        .single();
      if (!error && data) {
        await logAuditEvent(userId, 'case.updated', 'investigation_case', id, { updates });
        return data as InvestigationCase;
      }
    } catch (e) {
      console.warn('Supabase updateCase error:', e);
    }
  }

  const allCases = getLocalData<InvestigationCase[]>(STORAGE_KEYS.LOCAL_CASES, []);
  const index = allCases.findIndex((c) => c.id === id && c.user_id === userId);
  if (index === -1) return null;

  const updated = {
    ...allCases[index],
    ...updates,
    updated_at: now,
  };
  allCases[index] = updated;
  setLocalData(STORAGE_KEYS.LOCAL_CASES, allCases);
  await logAuditEvent(userId, 'case.updated_local', 'investigation_case', id, { updates });
  return updated;
}

// ============================================================================
// DIGITAL EVIDENCE REPOSITORY
// ============================================================================

export async function getEvidenceFiles(userId: string, caseId?: string): Promise<EvidenceFile[]> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      let query = supabase.from('evidence_files').select('*').order('created_at', { ascending: false });
      if (caseId) {
        query = query.eq('case_id', caseId);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data as EvidenceFile[];
      }
    } catch (e) {
      console.warn('Error getting evidence from Supabase:', e);
    }
  }

  const allEvidence = getLocalData<EvidenceFile[]>(STORAGE_KEYS.LOCAL_EVIDENCE, []);
  return allEvidence.filter((e) => e.user_id === userId && (!caseId || e.case_id === caseId));
}

export async function saveEvidenceFile(
  evidence: Omit<EvidenceFile, 'id' | 'created_at'>
): Promise<EvidenceFile> {
  const newEvidence: EvidenceFile = {
    ...evidence,
    id: crypto.randomUUID ? crypto.randomUUID() : `evd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    created_at: new Date().toISOString(),
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('evidence_files').insert(newEvidence).select().single();
      if (!error && data) {
        await logAuditEvent(newEvidence.user_id, 'evidence.uploaded', 'evidence_file', data.id, {
          file_name: newEvidence.file_name,
          sha256: newEvidence.sha256_hash,
        });
        return data as EvidenceFile;
      }
    } catch (e) {
      console.warn('Supabase saveEvidence failed:', e);
    }
  }

  const allEvidence = getLocalData<EvidenceFile[]>(STORAGE_KEYS.LOCAL_EVIDENCE, []);
  allEvidence.unshift(newEvidence);
  setLocalData(STORAGE_KEYS.LOCAL_EVIDENCE, allEvidence);
  await logAuditEvent(newEvidence.user_id, 'evidence.uploaded_local', 'evidence_file', newEvidence.id, {
    file_name: newEvidence.file_name,
    sha256: newEvidence.sha256_hash,
  });
  return newEvidence;
}

export async function deleteEvidenceFile(id: string, userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase.from('evidence_files').delete().eq('id', id);
      if (!error) {
        await logAuditEvent(userId, 'evidence.deleted', 'evidence_file', id, {});
        return true;
      }
    } catch (e) {
      console.warn('Supabase deleteEvidence error:', e);
    }
  }

  const allEvidence = getLocalData<EvidenceFile[]>(STORAGE_KEYS.LOCAL_EVIDENCE, []);
  const filtered = allEvidence.filter((e) => e.id !== id || e.user_id !== userId);
  setLocalData(STORAGE_KEYS.LOCAL_EVIDENCE, filtered);
  await logAuditEvent(userId, 'evidence.deleted_local', 'evidence_file', id, {});
  return true;
}

// ============================================================================
// CASE NOTES REPOSITORY
// ============================================================================

export async function getCaseNotes(caseId: string, userId: string): Promise<CaseNote[]> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('case_notes')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false });
      if (!error && data) {
        return data as CaseNote[];
      }
    } catch (e) {
      console.warn('Error getting case notes from Supabase:', e);
    }
  }

  const allNotes = getLocalData<CaseNote[]>(STORAGE_KEYS.LOCAL_NOTES, []);
  return allNotes.filter((n) => n.case_id === caseId && n.user_id === userId);
}

export async function addCaseNote(
  noteData: Omit<CaseNote, 'id' | 'created_at'>
): Promise<CaseNote> {
  const newNote: CaseNote = {
    ...noteData,
    id: crypto.randomUUID ? crypto.randomUUID() : `note_${Date.now()}`,
    created_at: new Date().toISOString(),
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('case_notes').insert(newNote).select().single();
      if (!error && data) {
        return data as CaseNote;
      }
    } catch (e) {
      console.warn('Supabase addCaseNote failed:', e);
    }
  }

  const allNotes = getLocalData<CaseNote[]>(STORAGE_KEYS.LOCAL_NOTES, []);
  allNotes.unshift(newNote);
  setLocalData(STORAGE_KEYS.LOCAL_NOTES, allNotes);
  return newNote;
}

// ============================================================================
// AUDIT LOGS REPOSITORY
// ============================================================================

export async function logAuditEvent(
  userId: string,
  eventType: string,
  resourceType: string,
  resourceId?: string,
  details: Record<string, any> = {}
): Promise<void> {
  const event: AuditEvent = {
    id: crypto.randomUUID ? crypto.randomUUID() : `aud_${Date.now()}`,
    user_id: userId,
    event_type: eventType,
    resource_type: resourceType,
    resource_id: resourceId,
    details,
    created_at: new Date().toISOString(),
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.from('audit_events').insert(event);
      return;
    } catch {
      // Ignore background audit failures
    }
  }

  const allAudit = getLocalData<AuditEvent[]>(STORAGE_KEYS.LOCAL_AUDIT, []);
  allAudit.unshift(event);
  if (allAudit.length > 200) allAudit.length = 200; // Cap local log
  setLocalData(STORAGE_KEYS.LOCAL_AUDIT, allAudit);
}

export async function getAuditEvents(userId: string): Promise<AuditEvent[]> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('audit_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data) {
        return data as AuditEvent[];
      }
    } catch (e) {
      console.warn('Error fetching audit events from Supabase:', e);
    }
  }

  const allAudit = getLocalData<AuditEvent[]>(STORAGE_KEYS.LOCAL_AUDIT, []);
  return allAudit.filter((a) => a.user_id === userId);
}

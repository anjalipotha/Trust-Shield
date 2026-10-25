import React, { useState, useEffect } from 'react';
import { UserProfile, InvestigationCase, EvidenceFile, CaseNote } from '../types';
import { getCases, getEvidenceFiles, getCaseNotes } from '../lib/supabase';
import {
  FileText,
  Printer,
  Shield,
  Download,
  Calendar,
  Lock,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  FileCheck2,
  Terminal,
} from 'lucide-react';

interface ReportsPageProps {
  user: UserProfile;
  initialCaseId?: string | null;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ user, initialCaseId }) => {
  const [cases, setCases] = useState<InvestigationCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(initialCaseId || '');
  const [selectedCase, setSelectedCase] = useState<InvestigationCase | null>(null);
  const [evidenceList, setEvidenceList] = useState<EvidenceFile[]>([]);
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCases();
  }, [user.id]);

  useEffect(() => {
    if (selectedCaseId) {
      loadCaseDetails(selectedCaseId);
    }
  }, [selectedCaseId]);

  const loadCases = async () => {
    try {
      setLoading(true);
      const data = await getCases(user.id);
      setCases(data);
      if (initialCaseId) {
        setSelectedCaseId(initialCaseId);
      } else if (data.length > 0) {
        setSelectedCaseId(data[0].id);
      }
    } catch (err) {
      console.error('Error loading cases for reporting:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCaseDetails = async (caseId: string) => {
    const found = cases.find((c) => c.id === caseId);
    if (found) {
      setSelectedCase(found);
    }
    try {
      const [ev, n] = await Promise.all([
        getEvidenceFiles(user.id, caseId),
        getCaseNotes(caseId, user.id),
      ]);
      setEvidenceList(ev);
      setNotes(n);
    } catch (err) {
      console.error('Error loading details for case report:', err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Controls (Hidden during print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-400" />
            <span>Forensic Investigation Reports</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Generate audit-grade printable dossiers with cryptographic evidence inventories and AI threat synthesis.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedCaseId}
            onChange={(e) => setSelectedCaseId(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
          >
            {cases.length === 0 && <option value="">No cases available</option>}
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.case_reference} - {c.title}
              </option>
            ))}
          </select>

          <button
            onClick={handlePrint}
            disabled={!selectedCase}
            className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-md transition-colors shadow-sm shadow-sky-600/30 flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* Main Printable Dossier Card */}
      {selectedCase ? (
        <div className="print-report-container bg-white text-slate-900 p-8 md:p-12 rounded-xl shadow-2xl border border-slate-200 max-w-4xl mx-auto space-y-8 font-sans">
          {/* Official TrustShield Header */}
          <div className="border-b-2 border-slate-900 pb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-slate-950 flex items-center justify-center text-white">
                  <Shield className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-950">
                    TRUSTSHIELD CYBERSECURITY
                  </h1>
                  <div className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">
                    Detect · Verify · Protect
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-600 mt-2 font-mono">
                Digital Forensics & Threat Assessment Unit
              </div>
            </div>

            <div className="text-left sm:text-right font-mono text-xs space-y-1">
              <div>
                <span className="text-slate-500">CASE FILE: </span>
                <strong className="text-slate-950 font-bold">{selectedCase.case_reference}</strong>
              </div>
              <div>
                <span className="text-slate-500">DATE: </span>
                <span>{new Date().toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-slate-500">INVESTIGATOR: </span>
                <span className="font-semibold">{user.display_name}</span>
              </div>
              <div>
                <span className="text-slate-500">STATUS: </span>
                <span className="uppercase font-bold text-sky-700">{selectedCase.status}</span>
              </div>
            </div>
          </div>

          {/* Section 1: Incident Identification */}
          <div className="space-y-2">
            <h2 className="text-xs uppercase font-mono tracking-wider font-bold text-slate-900 border-b border-slate-300 pb-1">
              01. Incident Summary & Objectives
            </h2>
            <div className="text-sm font-bold text-slate-900">{selectedCase.title}</div>
            <p className="text-xs text-slate-700 leading-relaxed font-mono bg-slate-50 p-3 rounded border border-slate-200">
              {selectedCase.description}
            </p>
            {selectedCase.incident_date && (
              <div className="text-[11px] font-mono text-slate-500">
                Primary Incident Timestamp: {selectedCase.incident_date}
              </div>
            )}
          </div>

          {/* Section 2: Evidentiary Categorization (Facts vs Allegations) */}
          <div className="space-y-3">
            <h2 className="text-xs uppercase font-mono tracking-wider font-bold text-slate-900 border-b border-slate-300 pb-1">
              02. Evidentiary Classification
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <div className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>USER-PROVIDED FACTS</span>
                </div>
                {selectedCase.ai_summary?.user_facts && selectedCase.ai_summary.user_facts.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
                    {selectedCase.ai_summary.user_facts.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">Direct observations documented by user.</p>
                )}
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <div className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5 font-mono">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>UNVERIFIED ALLEGATIONS</span>
                </div>
                {selectedCase.ai_summary?.unverified_allegations && selectedCase.ai_summary.unverified_allegations.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
                    {selectedCase.ai_summary.unverified_allegations.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">Claims lacking secondary technical corroboration.</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Technical Indicators & Associated Communications */}
          <div className="space-y-3">
            <h2 className="text-xs uppercase font-mono tracking-wider font-bold text-slate-900 border-b border-slate-300 pb-1">
              03. Associated Communications & Indicators
            </h2>

            {selectedCase.related_messages && selectedCase.related_messages.length > 0 && (
              <div>
                <div className="text-xs font-bold text-slate-800 mb-1">Suspicious Message Quotes</div>
                <div className="space-y-1.5">
                  {selectedCase.related_messages.map((m, i) => (
                    <div key={i} className="p-2 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-slate-800">
                      "{m}"
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedCase.related_urls && selectedCase.related_urls.length > 0 && (
              <div>
                <div className="text-xs font-bold text-slate-800 mb-1">Target URLs & Hosts</div>
                <div className="space-y-1">
                  {selectedCase.related_urls.map((u, i) => (
                    <div key={i} className="p-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-sky-800">
                      {u}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Digital Evidence Locker Inventory with SHA-256 Hashes */}
          <div className="space-y-3">
            <h2 className="text-xs uppercase font-mono tracking-wider font-bold text-slate-900 border-b border-slate-300 pb-1">
              04. Cryptographic Evidence Inventory
            </h2>

            {evidenceList.length === 0 ? (
              <p className="text-xs text-slate-500">No physical or digital files registered to this case.</p>
            ) : (
              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-300 font-mono text-[10px] text-slate-700 uppercase">
                    <tr>
                      <th className="py-2 px-3">File Name</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">SHA-256 Cryptographic Hash</th>
                      <th className="py-2 px-3 text-right">Acquired</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                    {evidenceList.map((e) => (
                      <tr key={e.id}>
                        <td className="py-2 px-3 font-semibold text-slate-900">{e.file_name}</td>
                        <td className="py-2 px-3 text-slate-600">{e.mime_type}</td>
                        <td className="py-2 px-3 text-slate-800 break-all">{e.sha256_hash}</td>
                        <td className="py-2 px-3 text-right text-slate-600">
                          {new Date(e.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 5: AI-Assisted Forensic Synthesis & Next Steps */}
          {selectedCase.ai_summary && (
            <div className="space-y-3">
              <h2 className="text-xs uppercase font-mono tracking-wider font-bold text-slate-900 border-b border-slate-300 pb-1">
                05. AI Synthesis & Evidentiary Gap Analysis
              </h2>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs leading-relaxed text-slate-800">
                {selectedCase.ai_summary.executive_summary}
              </div>

              {selectedCase.ai_summary.evidentiary_gaps && selectedCase.ai_summary.evidentiary_gaps.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-rose-800 mb-1">Identified Investigative Blind Spots:</div>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
                    {selectedCase.ai_summary.evidentiary_gaps.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedCase.ai_summary.recommended_next_steps && selectedCase.ai_summary.recommended_next_steps.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-slate-900 mb-1">Recommended Response Protocols:</div>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
                    {selectedCase.ai_summary.recommended_next_steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Official Disclaimers & Signatures */}
          <div className="pt-6 border-t-2 border-slate-900 text-[10px] text-slate-500 space-y-2 leading-relaxed">
            <p>
              <strong>LEGAL DISCLAIMER:</strong> This document is generated for investigative support, evidentiary cataloging, and internal threat assessment. TrustShield does not represent or replace sworn law enforcement agencies, does not file formal criminal complaints, and does not establish judicial guilt or civil liability. Digital hashes confirm integrity against post-collection tampering only.
            </p>
            <div className="flex justify-between pt-4 font-mono">
              <div>PREPARED BY: {user.display_name} ({user.email})</div>
              <div>CLASSIFICATION: TLP:AMBER+STRICT</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-xs text-slate-500 bg-[#0a0f1d] border border-slate-800 rounded-lg">
          No case selected. Please create or choose an investigation case to compile its forensic report.
        </div>
      )}
    </div>
  );
};

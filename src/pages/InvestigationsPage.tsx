import React, { useState, useEffect } from 'react';
import { UserProfile, InvestigationCase, CaseNote, EvidenceFile, CaseStatus, NoteType } from '../types';
import {
  getCases,
  saveCase,
  updateCase,
  getCaseNotes,
  addCaseNote,
  getEvidenceFiles,
} from '../lib/supabase';
import { createInvestigationSummaryApi } from '../lib/api';
import {
  FolderLock,
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileCheck2,
  MessageSquare,
  Link as LinkIcon,
  Sparkles,
  Printer,
  ChevronRight,
  Send,
  X,
  Calendar,
  Lock,
} from 'lucide-react';

interface InvestigationsPageProps {
  user: UserProfile;
  selectedCaseId?: string | null;
  onNavigateToReports: (caseId: string) => void;
  onNavigateToEvidence: (caseId?: string) => void;
}

export const InvestigationsPage: React.FC<InvestigationsPageProps> = ({
  user,
  selectedCaseId,
  onNavigateToReports,
  onNavigateToEvidence,
}) => {
  const [cases, setCases] = useState<InvestigationCase[]>([]);
  const [activeCase, setActiveCase] = useState<InvestigationCase | null>(null);
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [evidenceList, setEvidenceList] = useState<EvidenceFile[]>([]);
  const [loading, setLoading] = useState(true);

  // New Case Modal
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIncidentDate, setNewIncidentDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingCase, setSavingCase] = useState(false);

  // Note form state
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteType, setNewNoteType] = useState<NoteType>('observation');
  const [addingNote, setAddingNote] = useState(false);

  // Related message/URL input states
  const [newMessageText, setNewMessageText] = useState('');
  const [newUrlText, setNewUrlText] = useState('');

  // AI Summary synthesis state
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const loadCases = async () => {
    try {
      setLoading(true);
      const data = await getCases(user.id);
      setCases(data);
      if (selectedCaseId) {
        const found = data.find((c) => c.id === selectedCaseId);
        if (found) setActiveCase(found);
        else if (data.length > 0) setActiveCase(data[0]);
      } else if (data.length > 0 && !activeCase) {
        setActiveCase(data[0]);
      }
    } catch (err) {
      console.error('Error loading cases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, [user.id]);

  useEffect(() => {
    if (activeCase) {
      loadCaseDetails(activeCase.id);
    }
  }, [activeCase?.id]);

  const loadCaseDetails = async (caseId: string) => {
    try {
      const [fetchedNotes, fetchedEvidence] = await Promise.all([
        getCaseNotes(caseId, user.id),
        getEvidenceFiles(user.id, caseId),
      ]);
      setNotes(fetchedNotes);
      setEvidenceList(fetchedEvidence);
    } catch (err) {
      console.error('Error loading case details:', err);
    }
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) return;

    setSavingCase(true);
    try {
      const created = await saveCase({
        user_id: user.id,
        title: newTitle.trim(),
        description: newDesc.trim(),
        status: 'active',
        incident_date: newIncidentDate,
        related_messages: [],
        related_urls: [],
      });
      setCases([created, ...cases]);
      setActiveCase(created);
      setShowNewCaseModal(false);
      setNewTitle('');
      setNewDesc('');
    } catch (err) {
      console.error('Failed to create case:', err);
    } finally {
      setSavingCase(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase || !newNoteText.trim()) return;

    setAddingNote(true);
    try {
      const note = await addCaseNote({
        case_id: activeCase.id,
        user_id: user.id,
        note: newNoteText.trim(),
        note_type: newNoteType,
      });
      setNotes([note, ...notes]);
      setNewNoteText('');
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setAddingNote(false);
    }
  };

  const handleAddMessage = async () => {
    if (!activeCase || !newMessageText.trim()) return;
    const updated = [...(activeCase.related_messages || []), newMessageText.trim()];
    const saved = await updateCase(activeCase.id, user.id, { related_messages: updated });
    if (saved) {
      setActiveCase(saved);
      setCases(cases.map((c) => (c.id === saved.id ? saved : c)));
      setNewMessageText('');
    }
  };

  const handleAddUrl = async () => {
    if (!activeCase || !newUrlText.trim()) return;
    const updated = [...(activeCase.related_urls || []), newUrlText.trim()];
    const saved = await updateCase(activeCase.id, user.id, { related_urls: updated });
    if (saved) {
      setActiveCase(saved);
      setCases(cases.map((c) => (c.id === saved.id ? saved : c)));
      setNewUrlText('');
    }
  };

  const handleStatusChange = async (newStatus: CaseStatus) => {
    if (!activeCase) return;
    const saved = await updateCase(activeCase.id, user.id, { status: newStatus });
    if (saved) {
      setActiveCase(saved);
      setCases(cases.map((c) => (c.id === saved.id ? saved : c)));
    }
  };

  const handleGenerateSummary = async () => {
    if (!activeCase) return;
    setGeneratingSummary(true);
    setSummaryError(null);

    try {
      const res = await createInvestigationSummaryApi({
        case_reference: activeCase.case_reference,
        title: activeCase.title,
        description: activeCase.description,
        incident_date: activeCase.incident_date,
        related_messages: activeCase.related_messages || [],
        related_urls: activeCase.related_urls || [],
        notes: notes.map((n) => ({ type: n.note_type, text: n.note, date: n.created_at })),
        evidence_items: evidenceList.map((e) => ({
          file_name: e.file_name,
          sha256: e.sha256_hash,
          size: e.file_size,
        })),
      });

      const updated = await updateCase(activeCase.id, user.id, {
        ai_summary: {
          ...res.summary,
          generated_at: res.generated_at,
        },
      });

      if (updated) {
        setActiveCase(updated);
        setCases(cases.map((c) => (c.id === updated.id ? updated : c)));
      }
    } catch (err: any) {
      setSummaryError(err.message || 'Failed to synthesize investigation.');
    } finally {
      setGeneratingSummary(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <FolderLock className="w-5 h-5 text-sky-400" />
            <span>AI-Assisted Investigation Cases</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Organize digital evidence, correlate indicators, synthesize findings, and maintain chain-of-custody logs.
          </p>
        </div>

        <button
          onClick={() => setShowNewCaseModal(true)}
          className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-md transition-colors shadow-sm shadow-sky-600/30 flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Investigation Case</span>
        </button>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (4 cols): Case List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>CASES ({cases.length})</span>
            <span>FILTER: ALL</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 border border-slate-800 rounded-lg animate-pulse">
              Loading cases...
            </div>
          ) : cases.length === 0 ? (
            <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-lg text-center text-xs text-slate-500">
              No cases registered. Click "New Investigation Case" above to start.
            </div>
          ) : (
            <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
              {cases.map((c) => {
                const isSelected = activeCase?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setActiveCase(c)}
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-950/30 border-sky-500/50 shadow-md shadow-sky-950/20'
                        : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-mono font-bold text-sky-400">{c.case_reference}</span>
                      <span
                        className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded ${
                          c.status === 'active'
                            ? 'bg-sky-500/20 text-sky-300'
                            : c.status === 'review'
                            ? 'bg-amber-500/20 text-amber-300'
                            : c.status === 'closed'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {c.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="font-semibold text-xs text-white line-clamp-1">{c.title}</div>
                    <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">{c.description}</div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>{c.incident_date ? `Date: ${c.incident_date}` : 'Ongoing'}</span>
                      <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-sky-400' : 'text-slate-600'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column (8 cols): Active Case Dossier */}
        <div className="lg:col-span-8">
          {activeCase ? (
            <div className="bg-[#0a0f1d] border border-slate-800 rounded-lg p-5 md:p-6 space-y-6">
              {/* Dossier Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950/60 border border-sky-800/40 px-2 py-0.5 rounded">
                      {activeCase.case_reference}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Opened: {new Date(activeCase.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight">{activeCase.title}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={activeCase.status}
                    onChange={(e) => handleStatusChange(e.target.value as CaseStatus)}
                    className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                  >
                    <option value="active">Status: Active</option>
                    <option value="pending_evidence">Status: Pending Evidence</option>
                    <option value="review">Status: Under Review</option>
                    <option value="closed">Status: Closed</option>
                  </select>

                  <button
                    onClick={() => onNavigateToReports(activeCase.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-sky-400" />
                    <span>Report View</span>
                  </button>
                </div>
              </div>

              {/* Case Incident Summary Description */}
              <div>
                <h4 className="text-xs uppercase font-mono tracking-wider text-slate-400 font-semibold mb-2">
                  Incident Description & Primary Claims
                </h4>
                <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded text-xs text-slate-300 leading-relaxed font-mono">
                  {activeCase.description}
                </div>
              </div>

              {/* Related Messages & URLs Sub-Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Related Messages */}
                <div className="p-3.5 bg-slate-900/40 border border-slate-800 rounded-lg space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                      <span>Associated Messages ({activeCase.related_messages?.length || 0})</span>
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {activeCase.related_messages && activeCase.related_messages.length > 0 ? (
                      activeCase.related_messages.map((m, idx) => (
                        <div
                          key={idx}
                          className="p-2 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-300 font-mono line-clamp-2"
                        >
                          "{m}"
                        </div>
                      ))
                    ) : (
                      <div className="text-[11px] text-slate-500 py-1">No messages attached yet.</div>
                    )}
                  </div>

                  <div className="flex gap-1.5 pt-1">
                    <input
                      type="text"
                      value={newMessageText}
                      onChange={(e) => setNewMessageText(e.target.value)}
                      placeholder="Add suspicious message quote..."
                      className="flex-1 px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                    <button
                      onClick={handleAddMessage}
                      disabled={!newMessageText.trim()}
                      className="px-2.5 py-1 text-xs font-semibold bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Related URLs */}
                <div className="p-3.5 bg-slate-900/40 border border-slate-800 rounded-lg space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                    <span className="flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5 text-sky-400" />
                      <span>Associated URLs ({activeCase.related_urls?.length || 0})</span>
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {activeCase.related_urls && activeCase.related_urls.length > 0 ? (
                      activeCase.related_urls.map((u, idx) => (
                        <div
                          key={idx}
                          className="p-2 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-300 font-mono truncate"
                        >
                          {u}
                        </div>
                      ))
                    ) : (
                      <div className="text-[11px] text-slate-500 py-1">No URLs linked yet.</div>
                    )}
                  </div>

                  <div className="flex gap-1.5 pt-1">
                    <input
                      type="text"
                      value={newUrlText}
                      onChange={(e) => setNewUrlText(e.target.value)}
                      placeholder="https://malicious-link.com/..."
                      className="flex-1 px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                    />
                    <button
                      onClick={handleAddUrl}
                      disabled={!newUrlText.trim()}
                      className="px-2.5 py-1 text-xs font-semibold bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Evidence Locker Linkage */}
              <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-white">
                      Linked Digital Evidence Files ({evidenceList.length})
                    </span>
                  </div>
                  <button
                    onClick={() => onNavigateToEvidence(activeCase.id)}
                    className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1"
                  >
                    <span>Upload & Manage Hashes</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {evidenceList.length === 0 ? (
                  <div className="text-xs text-slate-500 py-1">
                    No evidence files linked to this case yet. Upload screenshots, email headers, or PDF records with SHA-256 verification.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {evidenceList.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-center justify-between p-2 bg-slate-900/80 border border-slate-800 rounded text-xs font-mono"
                      >
                        <span className="text-slate-200 truncate max-w-xs">{ev.file_name}</span>
                        <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
                          SHA256: {ev.sha256_hash.substring(0, 16)}...
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI-Assisted Case Synthesis Button & Output */}
              <div className="border border-sky-500/30 bg-sky-950/15 rounded-lg p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase font-mono tracking-wider">
                      <Sparkles className="w-4 h-4 text-sky-400" />
                      <span>AI Forensic Synthesis & Gap Analysis</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Synthesize case evidence, test against objective threat feeds, and identify evidentiary gaps.
                    </p>
                  </div>

                  <button
                    onClick={handleGenerateSummary}
                    disabled={generatingSummary}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-md transition-colors shadow-sm shadow-sky-600/30 flex items-center gap-2 shrink-0"
                  >
                    {generatingSummary ? (
                      <>
                        <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                        <span>Synthesizing Dossier...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{activeCase.ai_summary ? 'Re-Synthesize Dossier' : 'Generate Case Synthesis'}</span>
                      </>
                    )}
                  </button>
                </div>

                {summaryError && (
                  <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded text-xs text-rose-300">
                    {summaryError}
                  </div>
                )}

                {activeCase.ai_summary && (
                  <div className="mt-3 pt-3 border-t border-sky-800/30 space-y-3 text-xs">
                    <div>
                      <div className="text-[11px] uppercase font-mono text-sky-300 font-semibold mb-1">
                        Executive Summary
                      </div>
                      <p className="text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded border border-slate-800">
                        {activeCase.ai_summary.executive_summary}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-[11px] uppercase font-mono text-emerald-400 font-semibold mb-1">
                          User-Provided Facts
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                          {activeCase.ai_summary.user_facts?.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div className="text-[11px] uppercase font-mono text-amber-400 font-semibold mb-1">
                          Unverified Allegations / Claims
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                          {activeCase.ai_summary.unverified_allegations?.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {activeCase.ai_summary.evidentiary_gaps && activeCase.ai_summary.evidentiary_gaps.length > 0 && (
                      <div>
                        <div className="text-[11px] uppercase font-mono text-rose-400 font-semibold mb-1">
                          Evidentiary Blind Spots & Missing Information
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                          {activeCase.ai_summary.evidentiary_gaps.map((g, i) => (
                            <li key={i}>{g}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Case Notes & Timeline Section */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs uppercase font-mono tracking-wider text-slate-400 font-semibold">
                  Investigation Notes & Analyst Log ({notes.length})
                </h4>

                {/* Add Note Form */}
                <form onSubmit={handleAddNote} className="space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={newNoteType}
                      onChange={(e) => setNewNoteType(e.target.value as NoteType)}
                      className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-300 focus:outline-none"
                    >
                      <option value="observation">Observation</option>
                      <option value="lead">Technical Lead</option>
                      <option value="hypothesis">Hypothesis</option>
                      <option value="action_item">Action Item</option>
                    </select>

                    <input
                      type="text"
                      required
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder="Add an investigative finding, timestamp observation, or action item..."
                      className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />

                    <button
                      type="submit"
                      disabled={addingNote || !newNoteText.trim()}
                      className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded transition-colors flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Post</span>
                    </button>
                  </div>
                </form>

                {/* Notes List */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {notes.map((n) => (
                    <div
                      key={n.id}
                      className="p-3 bg-slate-900/60 border border-slate-800 rounded text-xs text-slate-200"
                    >
                      <div className="flex items-center justify-between mb-1 text-[10px] text-slate-500 font-mono">
                        <span className="uppercase text-sky-400 font-semibold">{n.note_type}</span>
                        <span>{new Date(n.created_at).toLocaleString()}</span>
                      </div>
                      <p className="leading-relaxed">{n.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-12 bg-[#0a0f1d] border border-slate-800 rounded-lg text-center text-xs text-slate-500">
              Select an investigation case on the left or create a new case to review forensic records.
            </div>
          )}
        </div>
      </div>

      {/* Modal: New Investigation Case */}
      {showNewCaseModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0a0f1d] border border-slate-800 rounded-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderLock className="w-4 h-4 text-sky-400" />
                <span>Create New Investigation Case</span>
              </h3>
              <button
                onClick={() => setShowNewCaseModal(false)}
                className="text-slate-500 hover:text-slate-300 text-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Case Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Wire Impersonation Scam targeting Accounts Payable"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Incident Date
                </label>
                <input
                  type="date"
                  value={newIncidentDate}
                  onChange={(e) => setNewIncidentDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Initial Incident Summary & Observations *
                </label>
                <textarea
                  required
                  rows={4}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Describe how the incident originated, what communications were received, and immediate actions taken..."
                  className="w-full p-3 bg-slate-900 border border-slate-800 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewCaseModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCase || !newTitle.trim()}
                  className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded transition-colors"
                >
                  {savingCase ? 'Creating Case...' : 'Initialize Dossier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

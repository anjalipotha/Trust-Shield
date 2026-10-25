import React, { useState, useEffect } from 'react';
import { UserProfile, EvidenceFile, InvestigationCase } from '../types';
import {
  getEvidenceFiles,
  saveEvidenceFile,
  deleteEvidenceFile,
  getCases,
  getSupabase,
} from '../lib/supabase';
import { computeSHA256, formatBytes, validateEvidenceFile } from '../lib/crypto';
import {
  FileCheck2,
  UploadCloud,
  Trash2,
  Download,
  Copy,
  Check,
  File,
  FileImage,
  FileText,
  AlertCircle,
  HelpCircle,
  FolderLock,
  Lock,
} from 'lucide-react';

interface EvidenceManagerPageProps {
  user: UserProfile;
  preselectedCaseId?: string | null;
}

export const EvidenceManagerPage: React.FC<EvidenceManagerPageProps> = ({
  user,
  preselectedCaseId,
}) => {
  const [evidenceList, setEvidenceList] = useState<EvidenceFile[]>([]);
  const [cases, setCases] = useState<InvestigationCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(preselectedCaseId || '');
  const [filterCaseId, setFilterCaseId] = useState<string>(preselectedCaseId || 'all');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user.id]);

  useEffect(() => {
    if (preselectedCaseId) {
      setSelectedCaseId(preselectedCaseId);
      setFilterCaseId(preselectedCaseId);
    }
  }, [preselectedCaseId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fetchedEvidence, fetchedCases] = await Promise.all([
        getEvidenceFiles(user.id),
        getCases(user.id),
      ]);
      setEvidenceList(fetchedEvidence);
      setCases(fetchedCases);
      if (fetchedCases.length > 0 && !selectedCaseId) {
        setSelectedCaseId(fetchedCases[0].id);
      }
    } catch (err) {
      console.error('Error loading evidence:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const validation = validateEvidenceFile(file);
    if (!validation.valid) {
      setUploadError(validation.error || 'Invalid evidence file.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      // 1. Calculate SHA-256 cryptographic digest using browser Web Crypto API
      const sha256 = await computeSHA256(file);

      // 2. Determine storage path
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const caseFolder = selectedCaseId || 'unassigned';
      const storagePath = `${user.id}/${caseFolder}/${Date.now()}_${safeFileName}`;

      // 3. If remote Supabase Storage is configured, upload to private bucket
      let fileUrl = '';
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data: uploadData, error: storageErr } = await supabase.storage
            .from('evidence-files')
            .upload(storagePath, file, {
              cacheControl: '3600',
              upsert: false,
            });

          if (storageErr) {
            console.warn('Supabase storage upload error, falling back to local Blob URL:', storageErr);
          } else if (uploadData) {
            // Generate private signed URL for authorized access
            const { data: signedData } = await supabase.storage
              .from('evidence-files')
              .createSignedUrl(storagePath, 3600);
            if (signedData?.signedUrl) {
              fileUrl = signedData.signedUrl;
            }
          }
        } catch (e) {
          console.warn('Storage upload fallback:', e);
        }
      }

      // If no remote URL, create in-memory blob URL for session download
      if (!fileUrl) {
        fileUrl = URL.createObjectURL(file);
      }

      // 4. Save metadata to evidence_files repository
      const saved = await saveEvidenceFile({
        user_id: user.id,
        case_id: selectedCaseId || null,
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        file_size: file.size,
        sha256_hash: sha256,
        notes: notes.trim() || undefined,
        file_url: fileUrl,
      });

      setEvidenceList([saved, ...evidenceList]);
      setNotes('');
      // Reset input
      e.target.value = '';
    } catch (err: any) {
      setUploadError(err.message || 'Evidence file upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this digital evidence record?')) return;
    try {
      await deleteEvidenceFile(id, user.id);
      setEvidenceList(evidenceList.filter((e) => e.id !== id));
    } catch (err) {
      console.error('Error deleting evidence:', err);
    }
  };

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const filteredEvidence =
    filterCaseId === 'all'
      ? evidenceList
      : evidenceList.filter((e) => e.case_id === filterCaseId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <FileCheck2 className="w-5 h-5 text-emerald-400" />
          <span>Digital Evidence Locker & Hash Integrity</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Store screenshots, email exports, logs, and communications with client-side SHA-256 cryptographic verification.
        </p>
      </div>

      {/* Forensic Integrity Banner */}
      <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-300 flex items-start gap-2.5">
        <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Cryptographic Authenticity Notice:</strong> SHA-256 digest calculations provide mathematical verification that a digital file has not been altered or tampered with following acquisition. A hash alone does not legally prove who created the original content. All files remain private to your authorized session.
        </div>
      </div>

      {/* Upload Box */}
      <div className="bg-[#0a0f1d] border border-slate-800 rounded-lg p-5 space-y-4">
        <h3 className="text-xs uppercase font-mono tracking-wider text-slate-300 font-semibold">
          Deposit Evidence File
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Associate with Investigation Case
            </label>
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
            >
              <option value="">General Evidence (No specific case)</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.case_reference} - {c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Evidence Notes / Chain of Custody Remarks
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Screenshot taken from victim mobile WhatsApp at 14:32 UTC"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {uploadError && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded text-xs text-rose-300">
            {uploadError}
          </div>
        )}

        <div className="relative border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-6 text-center transition-colors">
          <input
            type="file"
            disabled={uploading}
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <div className="flex flex-col items-center justify-center">
            <UploadCloud className={`w-8 h-8 ${uploading ? 'animate-bounce text-emerald-400' : 'text-slate-500'} mb-2`} />
            <div className="text-xs font-semibold text-white">
              {uploading ? 'Computing SHA-256 Digest & Depositing...' : 'Click or Drag & Drop Evidence File'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              PNG, JPG, WebP, PDF, TXT, JSON, EML/MSG files up to 20MB
            </p>
          </div>
        </div>
      </div>

      {/* Evidence Repository Table */}
      <div className="bg-[#0a0f1d] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-xs uppercase font-mono tracking-wider text-slate-300 font-semibold">
              Evidence Locker ({filteredEvidence.length} items)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Filter by Case:</span>
            <select
              value={filterCaseId}
              onChange={(e) => setFilterCaseId(e.target.value)}
              className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:outline-none"
            >
              <option value="all">All Cases</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.case_reference}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-xs text-slate-500 animate-pulse">
            Loading evidence catalog...
          </div>
        ) : filteredEvidence.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            No evidence records found for this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase font-mono text-slate-400">
                  <th className="py-2.5 px-3">File Name</th>
                  <th className="py-2.5 px-3">Size / Format</th>
                  <th className="py-2.5 px-3">SHA-256 Checksum</th>
                  <th className="py-2.5 px-3">Case Ref</th>
                  <th className="py-2.5 px-3">Acquisition Date</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredEvidence.map((ev) => {
                  const linkedCase = cases.find((c) => c.id === ev.case_id);
                  const isImage = ev.mime_type.startsWith('image/');
                  return (
                    <tr key={ev.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {isImage ? (
                            <FileImage className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <File className="w-4 h-4 text-sky-400 shrink-0" />
                          )}
                          <div>
                            <span className="font-semibold text-white block max-w-xs truncate">
                              {ev.file_name}
                            </span>
                            {ev.notes && (
                              <span className="text-[10px] text-slate-400 block truncate max-w-xs">
                                {ev.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-300">
                        {formatBytes(ev.file_size)}
                        <span className="text-[10px] text-slate-500 block truncate max-w-[120px]">
                          {ev.mime_type}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <span className="truncate max-w-[160px]" title={ev.sha256_hash}>
                            {ev.sha256_hash.substring(0, 16)}...
                          </span>
                          <button
                            onClick={() => copyHash(ev.sha256_hash)}
                            className="p-1 hover:text-sky-400 transition-colors"
                            title="Copy full SHA-256 hash"
                          >
                            {copiedHash === ev.sha256_hash ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px]">
                        {linkedCase ? (
                          <span className="text-sky-400 font-semibold">{linkedCase.case_reference}</span>
                        ) : (
                          <span className="text-slate-500">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                        {new Date(ev.created_at).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {ev.file_url && (
                            <a
                              href={ev.file_url}
                              download={ev.file_name}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                              title="Download evidence"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => handleDelete(ev.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                            title="Delete evidence record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

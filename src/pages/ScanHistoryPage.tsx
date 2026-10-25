import React, { useState, useEffect } from 'react';
import { UserProfile, ScanRecord, ScanType, RiskLevel } from '../types';
import { getScans, deleteScan } from '../lib/supabase';
import { RiskBadge } from '../components/RiskBadge';
import { ProviderStatusList } from '../components/ProviderStatusList';
import {
  History,
  Search,
  Filter,
  Trash2,
  Download,
  Eye,
  X,
  Calendar,
  AlertTriangle,
  Link2,
  MessageSquareWarning,
  ShoppingBag,
} from 'lucide-react';

interface ScanHistoryPageProps {
  user: UserProfile;
}

export const ScanHistoryPage: React.FC<ScanHistoryPageProps> = ({ user }) => {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ScanType>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | RiskLevel>('all');
  const [selectedScan, setSelectedScan] = useState<ScanRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScans();
  }, [user.id]);

  const loadScans = async () => {
    try {
      setLoading(true);
      const data = await getScans(user.id);
      setScans(data);
    } catch (err) {
      console.error('Error loading scans:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this scan record?')) return;
    try {
      await deleteScan(id, user.id);
      setScans(scans.filter((s) => s.id !== id));
      if (selectedScan?.id === id) {
        setSelectedScan(null);
      }
    } catch (err) {
      console.error('Error deleting scan:', err);
    }
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(scans, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `trustshield_scans_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredScans = scans.filter((scan) => {
    const matchesSearch =
      scan.input_summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scan.result_summary.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || scan.scan_type === typeFilter;
    const matchesRisk = riskFilter === 'all' || scan.risk_level === riskFilter;
    return matchesSearch && matchesType && matchesRisk;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-sky-400" />
            <span>Security Scan History</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Historical log of all suspicious message evaluations, URL intelligence queries, and marketplace checks.
          </p>
        </div>

        <button
          onClick={handleExportJSON}
          disabled={scans.length === 0}
          className="px-3.5 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md transition-colors flex items-center gap-2 self-start sm:self-auto disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5 text-sky-400" />
          <span>Export Scans (JSON)</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0a0f1d] border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search scans by keyword, domain, or summary..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:outline-none"
            >
              <option value="all">All Channels</option>
              <option value="message">Messages</option>
              <option value="url">URLs</option>
              <option value="product">Products</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Risk:</span>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as any)}
              className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:outline-none"
            >
              <option value="all">All Levels</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium / Suspicious</option>
              <option value="high">High Risk</option>
              <option value="critical">Critical</option>
              <option value="inconclusive">Inconclusive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Scans List Table */}
      <div className="bg-[#0a0f1d] border border-slate-800 rounded-lg p-5">
        {loading ? (
          <div className="text-center py-8 text-xs text-slate-500 animate-pulse">
            Loading scan history...
          </div>
        ) : filteredScans.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            No scans match your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase font-mono text-slate-400">
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Target / Input</th>
                  <th className="py-2.5 px-3">Risk Assessment</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredScans.map((scan) => {
                  return (
                    <tr
                      key={scan.id}
                      onClick={() => setSelectedScan(scan)}
                      className="hover:bg-slate-900/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3">
                        <span className="font-mono text-[10px] uppercase font-bold text-sky-400 bg-sky-950/60 border border-sky-800/40 px-2 py-0.5 rounded">
                          {scan.scan_type}
                        </span>
                      </td>

                      <td className="py-3 px-3 max-w-sm">
                        <div className="font-semibold text-white truncate">{scan.input_summary}</div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {scan.result_summary}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <RiskBadge level={scan.risk_level} score={scan.risk_score} />
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                        {new Date(scan.created_at).toLocaleString()}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedScan(scan);
                            }}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                            title="Inspect scan"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(scan.id, e)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                            title="Delete scan"
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

      {/* Inspect Scan Modal */}
      {selectedScan && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0a0f1d] border border-slate-800 rounded-lg p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-sky-400 uppercase bg-sky-950/60 border border-sky-800/40 px-2 py-0.5 rounded">
                  {selectedScan.scan_type} Scan
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {new Date(selectedScan.created_at).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setSelectedScan(null)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="text-sm font-bold text-white font-mono break-all">
                {selectedScan.input_summary}
              </div>
              <RiskBadge level={selectedScan.risk_level} score={selectedScan.risk_score} />
            </div>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 leading-relaxed">
              <div className="font-semibold text-slate-400 mb-1 text-[11px] uppercase font-mono">
                Executive Finding Summary
              </div>
              {selectedScan.result_summary}
            </div>

            {/* Providers if available */}
            {selectedScan.details?.providers && selectedScan.details.providers.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-300 mb-2 font-mono uppercase">
                  Queried Threat Intelligence Feeds
                </div>
                <ProviderStatusList providers={selectedScan.details.providers} />
              </div>
            )}

            {/* Suspicious Phrases or Indicators */}
            {selectedScan.details?.suspicious_indicators && selectedScan.details.suspicious_indicators.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-300 mb-2 font-mono uppercase">
                  Flagged Threat Indicators
                </div>
                <ul className="list-disc list-inside space-y-1 text-xs text-slate-300">
                  {selectedScan.details.suspicious_indicators.map((ind, i) => (
                    <li key={i}>{ind}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Raw Input Content */}
            {selectedScan.details?.raw_input && (
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-1 font-mono uppercase">
                  Original Inspected Payload
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded text-xs font-mono text-slate-300 max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {selectedScan.details.raw_input}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedScan(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

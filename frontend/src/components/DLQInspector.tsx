import { useState } from 'react';
import { DLQEntry } from '../types';
import { ShieldCheck, RefreshCw, Sparkles, AlertOctagon, Trash2, Eye } from 'lucide-react';

interface DLQInspectorProps {
  dlqEntries: DLQEntry[];
  onRefresh: () => void;
}

export const DLQInspector: React.FC<DLQInspectorProps> = ({ dlqEntries, onRefresh }) => {
  const [selectedEntry, setSelectedEntry] = useState<DLQEntry | null>(null);
  const [loadingAi, setLoadingAi] = useState<boolean>(false);

  const handleRetryDLQ = async (id: string) => {
    try {
      await fetch(`/api/dlq/${id}/retry`, { method: 'POST' });
      onRefresh();
      if (selectedEntry?.id === id) setSelectedEntry(null);
    } catch (err) {
      console.error('Failed to retry DLQ entry:', err);
    }
  };

  const handleDiscardDLQ = async (id: string) => {
    try {
      await fetch(`/api/dlq/${id}`, { method: 'DELETE' });
      onRefresh();
      if (selectedEntry?.id === id) setSelectedEntry(null);
    } catch (err) {
      console.error('Failed to discard DLQ entry:', err);
    }
  };

  const handleGenerateAiSummary = async (id: string) => {
    setLoadingAi(true);
    try {
      const res = await fetch(`/api/dlq/${id}/ai-summary`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (selectedEntry && selectedEntry.id === id) {
          setSelectedEntry({ ...selectedEntry, ai_failure_summary: data.aiSummary });
        }
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to generate AI summary:', err);
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-accentRose" /> Dead Letter Queue (DLQ) Inspector
          </h2>
          <p className="text-sm text-slate-400">Examine terminal job execution failures, inspect AI root-cause diagnostics, and replay jobs</p>
        </div>
      </div>

      {dlqEntries.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl border border-darkBorder space-y-3">
          <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto opacity-80" />
          <h3 className="text-lg font-bold text-white">Dead Letter Queue is Clean</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Zero terminal job failures detected. All workers operating normally with automatic backoff retries.
          </p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-darkBorder overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/80 text-xs uppercase text-slate-400 font-semibold border-b border-darkBorder">
                <tr>
                  <th className="px-6 py-4">Job Name</th>
                  <th className="px-6 py-4">Queue</th>
                  <th className="px-6 py-4">Attempts</th>
                  <th className="px-6 py-4">Terminal Error</th>
                  <th className="px-6 py-4">Failed Timestamp</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {dlqEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4 font-sans font-semibold text-white">{entry.job_name}</td>
                    <td className="px-6 py-4 font-sans text-slate-300">{entry.queue_name}</td>
                    <td className="px-6 py-4 text-rose-400 font-bold">{entry.total_attempts} Attempts</td>
                    <td className="px-6 py-4 max-w-xs truncate text-slate-400">{entry.final_error}</td>
                    <td className="px-6 py-4 text-slate-400">{new Date(entry.failed_at).toLocaleTimeString()}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedEntry(entry)}
                        className="p-1.5 rounded-lg bg-slate-800 text-accentCyan hover:bg-slate-700 transition"
                        title="View AI Diagnostics & Traceback"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRetryDLQ(entry.id)}
                        className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition"
                        title="Requeue DLQ Job"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDiscardDLQ(entry.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition"
                        title="Discard DLQ Entry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Diagnostic Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="glass-panel p-6 rounded-2xl border border-darkBorder w-full max-w-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-rose-400" /> Failure Diagnostic: {selectedEntry.job_name}
              </h3>
              <button onClick={() => setSelectedEntry(null)} className="text-slate-400 hover:text-white font-bold">&times;</button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="text-slate-400">Terminal Error Message:</div>
              <div className="text-rose-400 font-mono font-semibold">{selectedEntry.final_error}</div>
            </div>

            {/* AI Failure Summary Panel */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-violet-950/40 to-slate-900 border border-violet-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-accentViolet uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-accentViolet" /> AI Root Cause Analysis
                </span>
                {!selectedEntry.ai_failure_summary && (
                  <button
                    onClick={() => handleGenerateAiSummary(selectedEntry.id)}
                    disabled={loadingAi}
                    className="px-3 py-1 rounded-lg bg-accentViolet text-white font-semibold text-xs hover:opacity-90 transition disabled:opacity-50"
                  >
                    {loadingAi ? 'Analyzing...' : 'Generate AI Diagnosis'}
                  </button>
                )}
              </div>

              <div className="text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                {selectedEntry.ai_failure_summary || 'Click "Generate AI Diagnosis" to analyze error stack trace and payload.'}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => handleDiscardDLQ(selectedEntry.id)}
                className="px-4 py-2 rounded-lg bg-rose-500/20 text-rose-300 font-semibold text-xs hover:bg-rose-500/30 transition"
              >
                Discard Entry
              </button>
              <button
                onClick={() => handleRetryDLQ(selectedEntry.id)}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-black font-bold text-xs hover:opacity-90 transition"
              >
                Requeue Job Back to Pipeline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

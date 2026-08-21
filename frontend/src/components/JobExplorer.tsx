import { apiFetch } from '../utils/api';
import React, { useState } from 'react';
import { Job, Queue } from '../types';
import { Search, Filter, RefreshCw, Play, Eye, FileText, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface JobExplorerProps {
  jobs: Job[];
  queues: Queue[];
  onRefresh: () => void;
}

export const JobExplorer: React.FC<JobExplorerProps> = ({ jobs, queues, onRefresh }) => {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [queueFilter, setQueueFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobDetails, setJobDetails] = useState<any | null>(null);

  const fetchJobDetails = async (jobId: string) => {
    try {
      const res = await apiFetch(`/api/jobs/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setJobDetails(data);
        setSelectedJobId(jobId);
      }
    } catch (err) {
      console.error('Failed to fetch job details:', err);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await apiFetch(`/api/jobs/${jobId}/retry`, { method: 'POST' });
      onRefresh();
      if (selectedJobId === jobId) {
        fetchJobDetails(jobId);
      }
    } catch (err) {
      console.error('Failed to retry job:', err);
    }
  };

  const filteredJobs = jobs.filter((j) => {
    if (statusFilter && j.status !== statusFilter) return false;
    if (queueFilter && j.queue_id !== queueFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return j.id.toLowerCase().includes(q) || j.name.toLowerCase().includes(q) || j.payload.toLowerCase().includes(q);
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'QUEUED':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'RUNNING':
      case 'CLAIMED':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 animate-pulse';
      case 'COMPLETED':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'FAILED':
      case 'DEAD_LETTER':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-800 text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Controls */}
      <div className="glass-panel p-4 rounded-2xl border border-darkBorder flex flex-col md:flex-row gap-3 items-center justify-between">
        
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search Job ID, name, or payload..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-accentCyan"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-300 focus:outline-none focus:border-accentCyan"
          >
            <option value="">All Statuses</option>
            <option value="QUEUED">QUEUED</option>
            <option value="RUNNING">RUNNING</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="SCHEDULED">SCHEDULED</option>
            <option value="DEAD_LETTER">DEAD_LETTER</option>
          </select>

          {/* Queue Filter */}
          <select
            value={queueFilter}
            onChange={(e) => setQueueFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-300 focus:outline-none focus:border-accentCyan"
          >
            <option value="">All Queues</option>
            {queues.map((q) => (
              <option key={q.id} value={q.id}>{q.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Jobs Data Table */}
      <div className="glass-panel rounded-2xl border border-darkBorder overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400 font-semibold border-b border-darkBorder">
              <tr>
                <th className="px-6 py-4">Job ID / Name</th>
                <th className="px-6 py-4">Queue</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Attempts</th>
                <th className="px-6 py-4">Priority</th>
                <th className="px-6 py-4">Submitted At</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {filteredJobs.map((j) => (
                <tr key={j.id} className="hover:bg-slate-800/40 transition">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-white font-sans text-sm">{j.name}</div>
                    <div className="text-slate-400 text-[11px] font-mono">{j.id}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-300 font-sans">{j.queue_name || j.queue_id}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold ${getStatusBadge(j.status)}`}>
                      {j.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{j.attempts} / {j.max_retries}</td>
                  <td className="px-6 py-4">P{j.priority}</td>
                  <td className="px-6 py-4 text-slate-400">{new Date(j.created_at).toLocaleTimeString()}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => fetchJobDetails(j.id)}
                      className="p-1.5 rounded-lg bg-slate-800 text-accentCyan hover:bg-slate-700 transition"
                      title="Inspect Job & Execution Logs"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {(j.status === 'FAILED' || j.status === 'DEAD_LETTER') && (
                      <button
                        onClick={() => handleRetryJob(j.id)}
                        className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 transition"
                        title="Requeue Job"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Job Details Modal */}
      {selectedJobId && jobDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="glass-panel p-6 rounded-2xl border border-darkBorder w-full max-w-3xl max-h-[85vh] overflow-y-auto space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">{jobDetails.job.name}</h3>
                <p className="text-xs font-mono text-accentCyan">{jobDetails.job.id}</p>
              </div>
              <button
                onClick={() => setSelectedJobId(null)}
                className="text-slate-400 hover:text-white text-lg font-bold px-2"
              >
                &times;
              </button>
            </div>

            {/* Overview Metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400">Queue:</span>
                <div className="font-semibold text-white mt-0.5">{jobDetails.job.queue_name}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400">Type:</span>
                <div className="font-semibold text-white mt-0.5">{jobDetails.job.type}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400">Retry Policy:</span>
                <div className="font-semibold text-white mt-0.5">{jobDetails.job.retry_strategy}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400">Attempts:</span>
                <div className="font-semibold text-white mt-0.5">{jobDetails.job.attempts} / {jobDetails.job.max_retries}</div>
              </div>
            </div>

            {/* Payload */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Payload Data</h4>
              <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-accentCyan text-xs overflow-x-auto">
                {JSON.stringify(JSON.parse(jobDetails.job.payload || '{}'), null, 2)}
              </pre>
            </div>

            {/* Execution History */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Attempt Executions</h4>
              <div className="space-y-2">
                {jobDetails.executions.map((exec: any) => (
                  <div key={exec.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-between text-xs">
                    <div>
                      <span className="font-bold text-white">Attempt #{exec.attempt_number}</span>
                      <span className="ml-2 text-slate-400 font-mono">Worker: {exec.worker_id}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-slate-400">{exec.duration_ms || 0}ms</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        exec.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {exec.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Execution Logs */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Console Logs</h4>
              <div className="p-3 rounded-xl bg-black border border-slate-800 font-mono text-xs text-slate-300 space-y-1 max-h-40 overflow-y-auto">
                {jobDetails.logs.map((log: any) => (
                  <div key={log.id} className="flex space-x-2">
                    <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                    <span className={log.level === 'ERROR' ? 'text-rose-400 font-bold' : log.level === 'WARN' ? 'text-amber-400' : 'text-slate-300'}>
                      [{log.level}] {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { WorkerNode } from '../types';
import { Cpu, HardDrive, Activity, AlertTriangle, ShieldCheck, Power } from 'lucide-react';

interface WorkerMonitorProps {
  workers: WorkerNode[];
  onRefresh: () => void;
}

export const WorkerMonitor: React.FC<WorkerMonitorProps> = ({ workers, onRefresh }) => {
  const handleDrainWorker = async (workerId: string) => {
    if (!confirm(`Are you sure you want to drain worker ${workerId}?`)) return;
    try {
      await fetch(`/api/workers/${workerId}/drain`, { method: 'POST' });
      onRefresh();
    } catch (err) {
      console.error('Failed to drain worker:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-accentCyan" /> Worker Cluster Topology & Health
          </h2>
          <p className="text-sm text-slate-400">Monitor worker heartbeats, resource usage, active job tasks, and drain controls</p>
        </div>
      </div>

      {/* Workers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workers.map((w) => {
          const isDead = w.status === 'DEAD';
          const isDraining = w.status === 'DRAINING';

          return (
            <div
              key={w.id}
              className={`p-6 rounded-2xl glass-panel border transition-all space-y-4 shadow-lg ${
                isDead
                  ? 'border-rose-500/30 bg-rose-500/5'
                  : isDraining
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-darkBorder hover:border-accentCyan/40'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2.5 rounded-xl ${isDead ? 'bg-rose-500/20 text-rose-400' : 'bg-cyan-500/20 text-accentCyan'}`}>
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">{w.hostname}</h3>
                    <p className="text-xs font-mono text-slate-400">PID: {w.pid}</p>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  isDead
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : isDraining
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}>
                  {w.status}
                </span>
              </div>

              {/* Resource Usage Meters */}
              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span className="flex items-center gap-1"><Activity className="w-3 h-3 text-accentCyan" /> CPU Load</span>
                    <span className="font-mono text-white">{Math.round((w.cpu_percent || 0.1) * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-accentCyan h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(10, (w.cpu_percent || 0.1) * 100))}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span className="flex items-center gap-1"><HardDrive className="w-3 h-3 text-accentViolet" /> Memory (RAM)</span>
                    <span className="font-mono text-white">{w.memory_mb || 45} MB</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-accentViolet h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (w.memory_mb || 45) / 2)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Stats Footer */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400">Active Tasks: </span>
                  <strong className="text-accentCyan font-mono">{w.active_jobs_count || 0} / {w.concurrency_limit}</strong>
                </div>

                {!isDead && !isDraining && (
                  <button
                    onClick={() => handleDrainWorker(w.id)}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 transition text-xs font-semibold"
                  >
                    <Power className="w-3 h-3" />
                    <span>Drain</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

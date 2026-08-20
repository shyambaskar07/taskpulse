import React from 'react';
import { Queue, MetricsSummary } from '../types';
import { Layers, PlayCircle, CheckCircle2, AlertTriangle, AlertCircle, Cpu, Clock, Server } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface OverviewDashboardProps {
  queues: Queue[];
  metrics: MetricsSummary | null;
  setCurrentTab: (tab: string) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  queues,
  metrics,
  setCurrentTab,
}) => {
  const jobs = metrics?.jobs || {};

  const statCards = [
    { label: 'Queued Jobs', value: jobs.QUEUED || 0, icon: Clock, color: 'from-amber-500/20 to-amber-600/5', border: 'border-amber-500/30', text: 'text-amber-400' },
    { label: 'Running / Active', value: (jobs.CLAIMED || 0) + (jobs.RUNNING || 0), icon: PlayCircle, color: 'from-cyan-500/20 to-cyan-600/5', border: 'border-cyan-500/30', text: 'text-cyan-400' },
    { label: 'Completed Jobs', value: jobs.COMPLETED || 0, icon: CheckCircle2, color: 'from-emerald-500/20 to-emerald-600/5', border: 'border-emerald-500/30', text: 'text-emerald-400' },
    { label: 'Dead Letter Queue', value: jobs.DEAD_LETTER || 0, icon: AlertCircle, color: 'from-rose-500/20 to-rose-600/5', border: 'border-rose-500/30', text: 'text-rose-400' },
  ];

  // Dummy throughput trend telemetry
  const chartData = [
    { time: '12:00', throughput: 24, latency: 120 },
    { time: '12:05', throughput: 35, latency: 110 },
    { time: '12:10', throughput: 58, latency: 95 },
    { time: '12:15', throughput: 42, latency: 105 },
    { time: '12:20', throughput: 80, latency: 85 },
    { time: '12:25', throughput: 65, latency: 90 },
    { time: '12:30', throughput: 92, latency: 78 },
  ];

  return (
    <div className="space-y-6">
      {/* Metric Cards Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`p-5 rounded-2xl bg-gradient-to-br ${card.color} border ${card.border} backdrop-blur-md transition-all hover:scale-[1.02] shadow-lg`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">{card.label}</span>
                <div className={`p-2.5 rounded-xl bg-slate-900/60 ${card.text}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <span className={`text-3xl font-bold tracking-tight ${card.text}`}>
                  {card.value.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400 font-mono">Live</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts & System Performance Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Realtime Throughput Chart */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-darkBorder">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">System Throughput & Latency</h3>
              <p className="text-xs text-slate-400">Real-time jobs executed per minute across worker nodes</p>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="flex items-center text-accentCyan">
                <span className="w-2.5 h-2.5 rounded-full bg-accentCyan mr-1.5" /> Jobs/Min
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorThroughput" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#475569" fontSize={12} tickLine={false} />
                <YAxis stroke="#475569" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                />
                <Area type="monotone" dataKey="throughput" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorThroughput)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Worker Pool Health Summary */}
        <div className="glass-panel p-6 rounded-2xl border border-darkBorder space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-accentCyan" /> Worker Node Cluster
            </h3>
            <button
              onClick={() => setCurrentTab('workers')}
              className="text-xs font-semibold text-accentCyan hover:underline"
            >
              Manage Cluster &rarr;
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
              <div>
                <div className="text-xs text-slate-400">Active Workers</div>
                <div className="text-xl font-bold text-white mt-1">
                  {metrics?.workers.active || 0} / {metrics?.workers.total || 0} Nodes
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
                100%
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
              <div>
                <div className="text-xs text-slate-400">Avg Job Latency</div>
                <div className="text-xl font-bold text-white mt-1">
                  {metrics?.performance.avgDurationMs || 0} ms
                </div>
              </div>
              <div className="text-xs text-slate-400 font-mono bg-slate-800 px-2.5 py-1 rounded-md">
                Fast
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
              <div>
                <div className="text-xs text-slate-400">Worker Concurrency Limit</div>
                <div className="text-xl font-bold text-accentCyan mt-1">
                  {metrics?.workers.capacity || 0} Concurrent Slots
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Queues Summary Cards */}
      <div className="glass-panel p-6 rounded-2xl border border-darkBorder">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-accentCyan" /> Queue Health & Workload
          </h3>
          <button
            onClick={() => setCurrentTab('queues')}
            className="text-xs font-semibold text-accentCyan hover:underline"
          >
            Configure Queues &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {queues.map((q) => (
            <div key={q.id} className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-white">{q.name}</span>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                  q.is_paused ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {q.is_paused ? 'Paused' : 'Active'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-slate-950/50">
                  <div className="text-slate-400">Queued</div>
                  <div className="font-bold text-amber-400 mt-0.5">{q.queued_count}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/50">
                  <div className="text-slate-400">Active</div>
                  <div className="font-bold text-cyan-400 mt-0.5">{q.active_count}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/50">
                  <div className="text-slate-400">Completed</div>
                  <div className="font-bold text-emerald-400 mt-0.5">{q.completed_count}</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Priority Weight: <strong className="text-white">{q.priority}</strong></span>
                <span>Max Conc: <strong className="text-white">{q.max_concurrency}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

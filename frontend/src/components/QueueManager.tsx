import React, { useState } from 'react';
import { Queue } from '../types';
import { Plus, Pause, Play, Trash2, Sliders, Server, Shield } from 'lucide-react';

interface QueueManagerProps {
  queues: Queue[];
  onRefresh: () => void;
}

export const QueueManager: React.FC<QueueManagerProps> = ({ queues, onRefresh }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newQueueName, setNewQueueName] = useState('');
  const [newPriority, setNewPriority] = useState(5);
  const [newMaxConcurrency, setNewMaxConcurrency] = useState(10);

  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueueName) return;

    try {
      const res = await fetch('/api/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newQueueName,
          priority: newPriority,
          maxConcurrency: newMaxConcurrency,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewQueueName('');
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to create queue:', err);
    }
  };

  const handleTogglePause = async (queue: Queue) => {
    try {
      await fetch(`/api/queues/${queue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPaused: queue.is_paused ? false : true }),
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to update queue pause state:', err);
    }
  };

  const handlePurgeQueue = async (queueId: string) => {
    if (!confirm('Are you sure you want to purge all pending jobs in this queue?')) return;
    try {
      await fetch(`/api/queues/${queueId}/purge`, { method: 'POST' });
      onRefresh();
    } catch (err) {
      console.error('Failed to purge queue:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-accentCyan" /> Queue Configuration & Management
          </h2>
          <p className="text-sm text-slate-400">Configure queue priority weights, concurrency limits, and execution controls</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-accentCyan to-accentViolet text-black font-semibold text-sm shadow-lg shadow-accentCyan/20 hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Queue</span>
        </button>
      </div>

      {/* Queue Table */}
      <div className="glass-panel rounded-2xl border border-darkBorder overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400 font-semibold border-b border-darkBorder">
              <tr>
                <th className="px-6 py-4">Queue Name</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Priority Weight</th>
                <th className="px-6 py-4">Max Concurrency</th>
                <th className="px-6 py-4">Pending</th>
                <th className="px-6 py-4">Active</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {queues.map((q) => (
                <tr key={q.id} className="hover:bg-slate-800/40 transition">
                  <td className="px-6 py-4 font-semibold text-white flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-accentCyan" />
                    <span>{q.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        q.is_paused
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {q.is_paused ? 'PAUSED' : 'ACTIVE'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono font-medium">{q.priority} / 10</td>
                  <td className="px-6 py-4 font-mono font-medium">{q.max_concurrency} slots</td>
                  <td className="px-6 py-4 text-amber-400 font-bold">{q.queued_count}</td>
                  <td className="px-6 py-4 text-accentCyan font-bold">{q.active_count}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => handleTogglePause(q)}
                      className={`p-2 rounded-lg border text-xs font-semibold transition ${
                        q.is_paused
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                      }`}
                      title={q.is_paused ? 'Resume Queue' : 'Pause Queue'}
                    >
                      {q.is_paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handlePurgeQueue(q.id)}
                      className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition"
                      title="Purge Pending Jobs"
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

      {/* Create Queue Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel p-6 rounded-2xl border border-darkBorder w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">Create New Job Queue</h3>
            
            <form onSubmit={handleCreateQueue} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Queue Name</label>
                <input
                  type="text"
                  required
                  value={newQueueName}
                  onChange={(e) => setNewQueueName(e.target.value)}
                  placeholder="e.g. email-delivery"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-accentCyan"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Priority (1-10)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newPriority}
                    onChange={(e) => setNewPriority(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-accentCyan"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Max Concurrency</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newMaxConcurrency}
                    onChange={(e) => setNewMaxConcurrency(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-accentCyan"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-accentCyan text-black font-semibold hover:opacity-90"
                >
                  Save Queue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import { apiFetch } from '../utils/api';
import React, { useState } from 'react';
import { Queue } from '../types';
import { RefreshCw, Play, Clock, Repeat, Layers, GitBranch, Zap, CheckCircle2 } from 'lucide-react';

interface APITesterProps {
  queues: Queue[];
  onRefresh: () => void;
}

export const APITester: React.FC<APITesterProps> = ({ queues, onRefresh }) => {
  const [selectedQueue, setSelectedQueue] = useState<string>('q_default');
  const [jobName, setJobName] = useState<string>('Data Processor Workload');
  const [jobType, setJobType] = useState<string>('CALCULATION');
  const [priority, setPriority] = useState<number>(5);
  const [delaySec, setDelaySec] = useState<number>(0);
  const [cronExpr, setCronExpr] = useState<string>('');
  const [maxRetries, setMaxRetries] = useState<number>(3);
  const [retryStrategy, setRetryStrategy] = useState<string>('EXPONENTIAL');
  const [message, setMessage] = useState<string | null>(null);

  const triggerPreset = async (presetType: string) => {
    setMessage(null);
    try {
      let body: any = {
        queueId: selectedQueue,
        name: jobName,
        type: jobType,
        priority,
        maxRetries,
        retryStrategy,
      };

      if (presetType === 'IMMEDIATE') {
        body.payload = { message: 'Immediate processing workload', durationMs: 400 };
      } else if (presetType === 'DELAYED') {
        body.name = 'Delayed Sync Task (5s Delay)';
        body.delayMs = 5000;
        body.payload = { delaySeconds: 5 };
      } else if (presetType === 'CRON') {
        body.name = 'Recurring Report Job (Every 2 min)';
        body.cronExpression = '*/2 * * * *';
        body.payload = { reportType: 'SYSTEM_SUMMARY' };
      } else if (presetType === 'FAILING') {
        body.name = 'Failing Payment Webhook';
        body.type = 'SIMULATED_FAIL';
        body.payload = { errorReason: 'Simulated 503 Gateway Timeout from upstream server' };
      } else if (presetType === 'BATCH') {
        body.name = 'Batch Image Processing';
        body.batchItems = [
          { item: 1, filter: 'grayscale' },
          { item: 2, filter: 'blur' },
          { item: 3, filter: 'sharpen' },
          { item: 4, filter: 'sepia' },
          { item: 5, filter: 'resize' },
        ];
      } else if (presetType === 'DAG') {
        // Step 1: Submit parent job
        const parentRes = await apiFetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queueId: selectedQueue,
            name: 'DAG Parent: Fetch User Data',
            type: 'CALCULATION',
            payload: { step: '1_FETCH' }
          })
        });
        const parentData = await parentRes.json();

        // Step 2: Submit child job dependent on parent
        await apiFetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queueId: selectedQueue,
            name: 'DAG Child: Send Email Notification',
            type: 'CALCULATION',
            parentJobIds: [parentData.id],
            payload: { step: '2_NOTIFY', parentId: parentData.id }
          })
        });

        setMessage(`Created DAG Workflow: Child Job linked to Parent ${parentData.id}`);
        onRefresh();
        return;
      }

      const res = await apiFetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage(`Successfully submitted job: ${data.id || data.scheduledJobId || data.message}`);
        onRefresh();
      }
    } catch (err: any) {
      setMessage(`Error submitting job: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-accentCyan" /> REST API Playground & Workload Dispatcher
        </h2>
        <p className="text-sm text-slate-400">Trigger immediate, delayed, recurring cron, batch, and failing job workloads</p>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-accentCyan/10 border border-accentCyan/30 text-accentCyan text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          <span>{message}</span>
        </div>
      )}

      {/* Quick Action Presets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          onClick={() => triggerPreset('IMMEDIATE')}
          className="p-5 rounded-2xl glass-panel border border-darkBorder hover:border-accentCyan/50 transition text-left space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-white group-hover:text-accentCyan transition"> Immediate Job</span>
            <Zap className="w-5 h-5 text-accentCyan" />
          </div>
          <p className="text-xs text-slate-400">Enqueues job for instant execution by available worker nodes.</p>
        </button>

        <button
          onClick={() => triggerPreset('DELAYED')}
          className="p-5 rounded-2xl glass-panel border border-darkBorder hover:border-accentAmber/50 transition text-left space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-white group-hover:text-accentAmber transition">️ Delayed Job (5s)</span>
            <Clock className="w-5 h-5 text-accentAmber" />
          </div>
          <p className="text-xs text-slate-400">Schedules execution timestamp 5 seconds in the future.</p>
        </button>

        <button
          onClick={() => triggerPreset('CRON')}
          className="p-5 rounded-2xl glass-panel border border-darkBorder hover:border-accentViolet/50 transition text-left space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-white group-hover:text-accentViolet transition"> Recurring Cron Job</span>
            <Repeat className="w-5 h-5 text-accentViolet" />
          </div>
          <p className="text-xs text-slate-400">Registers cron schedule (e.g. */2 * * * *) with automatic recurring runs.</p>
        </button>

        <button
          onClick={() => triggerPreset('FAILING')}
          className="p-5 rounded-2xl glass-panel border border-darkBorder hover:border-rose-500/50 transition text-left space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-white group-hover:text-rose-400 transition"> Failing Job (Test Retries & DLQ)</span>
            <Play className="w-5 h-5 text-rose-400" />
          </div>
          <p className="text-xs text-slate-400">Simulates execution failure to test exponential backoff and DLQ routing.</p>
        </button>

        <button
          onClick={() => triggerPreset('BATCH')}
          className="p-5 rounded-2xl glass-panel border border-darkBorder hover:border-emerald-500/50 transition text-left space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-white group-hover:text-emerald-400 transition"> Batch Workload (5 Items)</span>
            <Layers className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-xs text-slate-400">Submits multiple sub-jobs concurrently in a single API call.</p>
        </button>

        <button
          onClick={() => triggerPreset('DAG')}
          className="p-5 rounded-2xl glass-panel border border-darkBorder hover:border-cyan-500/50 transition text-left space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-white group-hover:text-cyan-400 transition"> DAG Workflow (Parent -&gt; Child)</span>
            <GitBranch className="w-5 h-5 text-cyan-400" />
          </div>
          <p className="text-xs text-slate-400">Creates dependent workflow chain where child waits for parent completion.</p>
        </button>
      </div>
    </div>
  );
};

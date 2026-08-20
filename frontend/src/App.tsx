import { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { OverviewDashboard } from './components/OverviewDashboard';
import { QueueManager } from './components/QueueManager';
import { JobExplorer } from './components/JobExplorer';
import { WorkerMonitor } from './components/WorkerMonitor';
import { DLQInspector } from './components/DLQInspector';
import { APITester } from './components/APITester';
import { Queue, Job, WorkerNode, DLQEntry, MetricsSummary } from './types';

export function App() {
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workers, setWorkers] = useState<WorkerNode[]>([]);
  const [dlqEntries, setDlqEntries] = useState<DLQEntry[]>([]);
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);

  const fetchAllData = useCallback(async () => {
    try {
      const [qRes, jRes, wRes, dRes, mRes] = await Promise.all([
        fetch('/api/queues'),
        fetch('/api/jobs?limit=50'),
        fetch('/api/workers'),
        fetch('/api/dlq'),
        fetch('/api/metrics')
      ]);

      if (qRes.ok) setQueues((await qRes.json()).queues || []);
      if (jRes.ok) setJobs((await jRes.json()).jobs || []);
      if (wRes.ok) setWorkers((await wRes.json()).workers || []);
      if (dRes.ok) setDlqEntries((await dRes.json()).dlqEntries || []);
      if (mRes.ok) setMetrics(await mRes.json());
    } catch (err) {
      console.error('Failed to fetch platform data:', err);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 3000); // fallback poll 3s

    // Connect to WebSocket stream
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setIsWsConnected(true);
    ws.onclose = () => setIsWsConnected(false);
    ws.onerror = () => setIsWsConnected(false);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'JOB_UPDATED' || msg.type === 'JOB_CREATED' || msg.type === 'WORKER_HEARTBEAT' || msg.type === 'QUEUE_UPDATED') {
          fetchAllData();
        }
      } catch {
        // ignore
      }
    };

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, [fetchAllData]);

  return (
    <div className="min-h-screen flex flex-col bg-darkBg text-slate-100 font-sans">
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isWsConnected={isWsConnected}
        onRefresh={fetchAllData}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentTab === 'overview' && (
          <OverviewDashboard queues={queues} metrics={metrics} setCurrentTab={setCurrentTab} />
        )}
        {currentTab === 'queues' && (
          <QueueManager queues={queues} onRefresh={fetchAllData} />
        )}
        {currentTab === 'jobs' && (
          <JobExplorer jobs={jobs} queues={queues} onRefresh={fetchAllData} />
        )}
        {currentTab === 'workers' && (
          <WorkerMonitor workers={workers} onRefresh={fetchAllData} />
        )}
        {currentTab === 'dlq' && (
          <DLQInspector dlqEntries={dlqEntries} onRefresh={fetchAllData} />
        )}
        {currentTab === 'api-tester' && (
          <APITester queues={queues} onRefresh={fetchAllData} />
        )}
      </main>

      <footer className="glass-panel border-t border-darkBorder py-4 text-center text-xs text-slate-500">
        TaskPulse Distributed Job Scheduling Platform &bull; Production Backend & Web Dashboard Engine
      </footer>
    </div>
  );
}

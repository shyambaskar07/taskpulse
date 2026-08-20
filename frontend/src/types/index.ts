export interface Queue {
  id: string;
  project_id: string;
  name: string;
  priority: number;
  max_concurrency: number;
  retry_policy_id?: string;
  is_paused: number;
  queued_count: number;
  active_count: number;
  completed_count: number;
  failed_count: number;
  dlq_count: number;
  created_at: string;
}

export interface Job {
  id: string;
  queue_id: string;
  queue_name?: string;
  parent_job_id?: string;
  name: string;
  type: 'HTTP' | 'SHELL' | 'CALCULATION' | 'SIMULATED_FAIL' | 'DAG';
  payload: string;
  status: 'QUEUED' | 'SCHEDULED' | 'CLAIMED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTER';
  priority: number;
  run_at: string;
  attempts: number;
  max_retries: number;
  retry_strategy: string;
  timeout_ms: number;
  claimed_by_worker_id?: string;
  claimed_at?: string;
  completed_at?: string;
  failed_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkerNode {
  id: string;
  hostname: string;
  pid: number;
  concurrency_limit: number;
  status: 'ACTIVE' | 'DRAINING' | 'DEAD';
  registered_at: string;
  last_heartbeat: string;
  cpu_percent?: number;
  memory_mb?: number;
  active_jobs_count?: number;
}

export interface DLQEntry {
  id: string;
  job_id: string;
  queue_id: string;
  job_name: string;
  job_payload: string;
  job_type: string;
  queue_name: string;
  failed_at: string;
  final_error: string;
  total_attempts: number;
  ai_failure_summary?: string;
  status: 'PENDING' | 'RETRIED' | 'DISCARDED';
}

export interface MetricsSummary {
  jobs: Record<string, number>;
  workers: {
    total: number;
    active: number;
    capacity: number;
  };
  performance: {
    avgDurationMs: number;
    maxDurationMs: number;
    totalExecutions: number;
  };
}

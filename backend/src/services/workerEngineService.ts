import { getClient, query } from '../db/database';
import { calculateRetryDelay } from '../utils/retryCalculator';
import { generateAIFailureSummary } from '../utils/aiSummarizer';
import { wsManager } from './websocketService';
import { generateId } from '../utils/idGenerator';
import os from 'os';

export class WorkerEngine {
  public workerId: string;
  public hostname: string;
  public pid: number;
  public concurrencyLimit: number;
  private isRunning: boolean = false;
  private isDraining: boolean = false;
  private activeJobsCount: number = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(concurrencyLimit: number = 5) {
    this.hostname = os.hostname();
    this.pid = process.pid;
    this.workerId = generateId(`wrk_${this.hostname}_${this.pid}`);
    this.concurrencyLimit = concurrencyLimit;
  }

  public async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    const now = new Date().toISOString();
    await query(`
      INSERT INTO workers (id, hostname, pid, concurrency_limit, status, registered_at, last_heartbeat)
      VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $6)
      ON CONFLICT(id) DO UPDATE SET status = 'ACTIVE', last_heartbeat = $6
    `, [this.workerId, this.hostname, this.pid, this.concurrencyLimit, now, now]);

    console.log(`[Worker ${this.workerId}] Started with concurrency limit ${this.concurrencyLimit}`);

    this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), 5000);
    this.sendHeartbeat();

    this.pollInterval = setInterval(() => this.pollAndExecuteJobs(), 500);
  }

  private async sendHeartbeat() {
    try {
      const now = new Date().toISOString();
      const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
      const cpuLoad = os.loadavg()[0] || 0.1;

      await query(`UPDATE workers SET last_heartbeat = $1 WHERE id = $2`, [now, this.workerId]);

      const hbId = generateId('hb');
      await query(`
        INSERT INTO worker_heartbeats (id, worker_id, timestamp, cpu_percent, memory_mb, active_jobs_count)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [hbId, this.workerId, now, cpuLoad, memUsage, this.activeJobsCount]);

      wsManager.broadcast('WORKER_HEARTBEAT', {
        workerId: this.workerId,
        hostname: this.hostname,
        activeJobsCount: this.activeJobsCount,
        memoryMb: Math.round(memUsage),
        timestamp: now
      });
    } catch (err) {
      console.error(`[Worker ${this.workerId}] Heartbeat failed:`, err);
    }
  }

  private async pollAndExecuteJobs() {
    if (!this.isRunning || this.isDraining) return;
    if (this.activeJobsCount >= this.concurrencyLimit) return;

    const availableSlots = this.concurrencyLimit - this.activeJobsCount;

    for (let i = 0; i < availableSlots; i++) {
      const job = await this.claimNextJobAtomic();
      if (!job) break;

      this.activeJobsCount++;
      this.executeJobAsync(job).finally(() => {
        this.activeJobsCount--;
      });
    }
  }

  private async claimNextJobAtomic(): Promise<any | null> {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const now = new Date().toISOString();

      const res = await client.query(`
        UPDATE jobs
        SET status = 'CLAIMED',
            claimed_by_worker_id = $1,
            claimed_at = $2,
            attempts = attempts + 1,
            updated_at = $2
        WHERE id = (
          SELECT j.id
          FROM jobs j
          JOIN queues q ON j.queue_id = q.id
          WHERE q.is_paused = 0
            AND j.status IN ('QUEUED', 'SCHEDULED')
            AND j.run_at <= $2
            AND NOT EXISTS (
              SELECT 1 FROM job_dependencies jd
              WHERE jd.child_job_id = j.id AND jd.status != 'SATISFIED'
            )
          ORDER BY q.priority DESC, j.priority DESC, j.created_at ASC
          FOR UPDATE OF j SKIP LOCKED
          LIMIT 1
        )
        RETURNING *
      `, [this.workerId, now]);

      await client.query('COMMIT');
      return res.rows.length > 0 ? res.rows[0] : null;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error claiming job atomically in Postgres:', err);
      return null;
    } finally {
      client.release();
    }
  }

  private async executeJobAsync(job: any) {
    const executionId = generateId('exec');
    const startTime = Date.now();
    const nowIso = new Date().toISOString();

    await query(`UPDATE jobs SET status = 'RUNNING', updated_at = $1 WHERE id = $2`, [nowIso, job.id]);

    await query(`
      INSERT INTO job_executions (id, job_id, worker_id, attempt_number, status, started_at)
      VALUES ($1, $2, $3, $4, 'RUNNING', $5)
    `, [executionId, job.id, this.workerId, job.attempts, nowIso]);

    await this.addJobLog(job.id, executionId, 'INFO', `Job claimed by worker ${this.workerId} (Attempt ${job.attempts}/${job.max_retries})`);
    wsManager.broadcast('JOB_UPDATED', { jobId: job.id, status: 'RUNNING', workerId: this.workerId });

    let isSuccess = false;
    let errorMsg = '';

    try {
      await this.runTaskSandbox(job, executionId);
      isSuccess = true;
    } catch (err: any) {
      isSuccess = false;
      errorMsg = err.message || String(err);
    }

    const durationMs = Date.now() - startTime;
    const finishIso = new Date().toISOString();

    if (isSuccess) {
      await query(`
        UPDATE jobs
        SET status = 'COMPLETED', completed_at = $1, updated_at = $2
        WHERE id = $3
      `, [finishIso, finishIso, job.id]);

      await query(`
        UPDATE job_executions
        SET status = 'COMPLETED', finished_at = $1, duration_ms = $2
        WHERE id = $3
      `, [finishIso, durationMs, executionId]);

      await this.addJobLog(job.id, executionId, 'INFO', `Job executed successfully in ${durationMs}ms`);

      await query(`
        UPDATE job_dependencies
        SET status = 'SATISFIED'
        WHERE parent_job_id = $1
      `, [job.id]);

      wsManager.broadcast('JOB_UPDATED', { jobId: job.id, status: 'COMPLETED', durationMs });
    } else {
      await query(`
        UPDATE job_executions
        SET status = 'FAILED', error_message = $1, finished_at = $2, duration_ms = $3
        WHERE id = $4
      `, [errorMsg, finishIso, durationMs, executionId]);

      await this.addJobLog(job.id, executionId, 'ERROR', `Execution failed: ${errorMsg}`);

      if (job.attempts < job.max_retries) {
        const delayMs = calculateRetryDelay({
          strategy: (job.retry_strategy || 'EXPONENTIAL') as any,
          attemptNumber: job.attempts,
          baseDelayMs: job.base_delay_ms || 1000,
          maxDelayMs: job.max_delay_ms || 60000,
          useJitter: true
        });

        const nextRunAt = new Date(Date.now() + delayMs).toISOString();

        await query(`
          UPDATE jobs
          SET status = 'SCHEDULED', run_at = $1, error_message = $2, updated_at = $3
          WHERE id = $4
        `, [nextRunAt, errorMsg, finishIso, job.id]);

        await this.addJobLog(
          job.id, executionId, 'WARN',
          `Retry scheduled in ${delayMs}ms (Strategy: ${job.retry_strategy || 'EXPONENTIAL'}). Next run at ${nextRunAt}`
        );

        wsManager.broadcast('JOB_UPDATED', { jobId: job.id, status: 'SCHEDULED', retryDelayMs: delayMs });
      } else {
        await query(`
          UPDATE jobs
          SET status = 'DEAD_LETTER', failed_at = $1, error_message = $2, updated_at = $3
          WHERE id = $4
        `, [finishIso, errorMsg, finishIso, job.id]);

        const aiSummary = generateAIFailureSummary(job.name, job.payload, errorMsg, job.attempts);

        const dlqId = generateId('dlq');
        await query(`
          INSERT INTO dead_letter_queue (id, job_id, queue_id, failed_at, final_error, total_attempts, ai_failure_summary, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
        `, [dlqId, job.id, job.queue_id, finishIso, errorMsg, job.attempts, aiSummary]);

        await query(`
          UPDATE job_dependencies
          SET status = 'FAILED'
          WHERE parent_job_id = $1
        `, [job.id]);

        await this.addJobLog(job.id, executionId, 'ERROR', `Max retries reached (${job.attempts}/${job.max_retries}). Moved to Dead Letter Queue.`);
        wsManager.broadcast('JOB_UPDATED', { jobId: job.id, status: 'DEAD_LETTER', dlqId, errorMsg });
      }
    }
  }

  private async runTaskSandbox(job: any, executionId: string): Promise<void> {
    let payloadObj: any = {};
    try {
      payloadObj = JSON.parse(job.payload || '{}');
    } catch {
      payloadObj = {};
    }

    if (job.type === 'SIMULATED_FAIL') {
      await new Promise((r) => setTimeout(r, 400));
      throw new Error(payloadObj.errorReason || 'Simulated internal processing exception');
    }

    if (job.type === 'HTTP') {
      await this.addJobLog(job.id, executionId, 'INFO', `HTTP Task: Invoking ${payloadObj.method || 'GET'} ${payloadObj.url || 'https://api.example.com'}`);
      await new Promise((r) => setTimeout(r, 600));
      if (payloadObj.simulateError) {
        throw new Error('HTTP 503 Gateway Timeout from upstream server');
      }
      return;
    }

    if (job.type === 'SHELL') {
      await this.addJobLog(job.id, executionId, 'INFO', `SHELL Task: Executing script command: ${payloadObj.command || 'echo TaskPulse'}`);
      await new Promise((r) => setTimeout(r, 300));
      return;
    }

    await this.addJobLog(job.id, executionId, 'INFO', `Processing workload payload data: ${JSON.stringify(payloadObj)}`);
    const duration = payloadObj.durationMs || 500 + Math.floor(Math.random() * 400);
    await new Promise((r) => setTimeout(r, duration));
  }

  private async addJobLog(jobId: string, executionId: string, level: string, message: string) {
    const logId = generateId('log');
    await query(`
      INSERT INTO job_logs (id, execution_id, job_id, timestamp, level, message)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5)
    `, [logId, executionId, jobId, level, message]);
  }

  public async shutdown() {
    console.log(`[Worker ${this.workerId}] Initiating graceful shutdown...`);
    this.isDraining = true;
    await query(`UPDATE workers SET status = 'DRAINING' WHERE id = $1`, [this.workerId]);

    const startWait = Date.now();
    while (this.activeJobsCount > 0 && Date.now() - startWait < 10000) {
      await new Promise((r) => setTimeout(r, 200));
    }

    this.isRunning = false;
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.pollInterval) clearInterval(this.pollInterval);

    await query(`UPDATE workers SET status = 'DEAD' WHERE id = $1`, [this.workerId]);
    console.log(`[Worker ${this.workerId}] Shutdown complete.`);
  }
}

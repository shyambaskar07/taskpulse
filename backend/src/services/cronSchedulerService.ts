import { query, queryRows } from '../db/database';
import { getNextCronOccurrence } from '../utils/cronHelper';
import { wsManager } from './websocketService';
import { generateId } from '../utils/idGenerator';

export class CronSchedulerService {
  private timer: NodeJS.Timeout | null = null;
  private recoveryTimer: NodeJS.Timeout | null = null;

  public start() {
    this.timer = setInterval(() => this.evaluateScheduledJobs(), 3000);
    this.recoveryTimer = setInterval(() => this.recoverStrandedJobs(), 10000);
  }

  public stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.recoveryTimer) clearInterval(this.recoveryTimer);
  }

  private async evaluateScheduledJobs() {
    try {
      const nowIso = new Date().toISOString();
      const dueScheduledJobs = await queryRows(
        `SELECT * FROM scheduled_jobs WHERE is_active = 1 AND next_run_at <= $1`,
        [nowIso]
      );

      for (const sj of dueScheduledJobs) {
        const jobId = generateId('job_cron');
        const now = new Date().toISOString();

        await query(
          `INSERT INTO jobs (id, queue_id, name, type, payload, status, run_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'QUEUED', $6, $7, $8)`,
          [jobId, sj.queue_id, sj.name, sj.job_type, sj.payload, now, now, now]
        );

        const nextRun = getNextCronOccurrence(sj.cron_expression, new Date()).toISOString();
        await query(
          `UPDATE scheduled_jobs SET last_run_at = $1, next_run_at = $2 WHERE id = $3`,
          [now, nextRun, sj.id]
        );

        wsManager.broadcast('JOB_CREATED', { jobId, queueId: sj.queue_id, type: 'RECURRING_CRON', name: sj.name });
      }
    } catch (err) {
      console.error('Error in CronSchedulerService:', err);
    }
  }

  public async recoverStrandedJobs() {
    try {
      const cutoff = new Date(Date.now() - 30000).toISOString();
      const staleWorkers = await queryRows(
        `SELECT id FROM workers WHERE status != 'DEAD' AND last_heartbeat < $1`,
        [cutoff]
      );

      for (const w of staleWorkers) {
        await query(`UPDATE workers SET status = 'DEAD' WHERE id = $1`, [w.id]);

        const strandedJobs = await queryRows(
          `SELECT id, attempts, max_retries FROM jobs WHERE claimed_by_worker_id = $1 AND status IN ('CLAIMED', 'RUNNING')`,
          [w.id]
        );

        for (const job of strandedJobs) {
          const now = new Date().toISOString();
          await query(
            `UPDATE jobs
             SET status = 'QUEUED', claimed_by_worker_id = NULL, claimed_at = NULL,
                 error_message = 'Worker crashed or lost heartbeat (Reclaimed by System)',
                 updated_at = $1
             WHERE id = $2`,
            [now, job.id]
          );

          wsManager.broadcast('JOB_RECLAIMED', { jobId: job.id, workerId: w.id });
        }
      }
    } catch (err) {
      console.error('Error recovering stranded jobs:', err);
    }
  }
}

export const cronScheduler = new CronSchedulerService();

import { Router, Request, Response } from 'express';
import { queryOne, queryRows } from '../db/database';

export const prometheusRouter = Router();

prometheusRouter.get('/', async (req: Request, res: Response) => {
  try {
    const jobStats = await queryRows(`
      SELECT status, count(*) as count
      FROM jobs
      GROUP BY status
    `);

    const workerStats = await queryOne(`
      SELECT
        count(*) as total_workers,
        sum(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_workers,
        sum(concurrency_limit) as total_capacity
      FROM workers
    `) || {};

    const executionStats = await queryOne(`
      SELECT
        avg(duration_ms) as avg_duration_ms,
        count(*) as total_executions
      FROM job_executions
      WHERE status = 'COMPLETED'
    `) || {};

    let output = `# HELP taskpulse_jobs_total Total count of jobs partitioned by status\n`;
    output += `# TYPE taskpulse_jobs_total counter\n`;
    jobStats.forEach((row) => {
      output += `taskpulse_jobs_total{status="${row.status}"} ${row.count}\n`;
    });

    output += `\n# HELP taskpulse_worker_cluster_capacity Total worker concurrency capacity\n`;
    output += `# TYPE taskpulse_worker_cluster_capacity gauge\n`;
    output += `taskpulse_worker_cluster_capacity ${workerStats.total_capacity || 0}\n`;

    output += `\n# HELP taskpulse_active_workers Number of active worker nodes\n`;
    output += `# TYPE taskpulse_active_workers gauge\n`;
    output += `taskpulse_active_workers ${workerStats.active_workers || 0}\n`;

    output += `\n# HELP taskpulse_job_execution_duration_avg_ms Average job execution duration in milliseconds\n`;
    output += `# TYPE taskpulse_job_execution_duration_avg_ms gauge\n`;
    output += `taskpulse_job_execution_duration_avg_ms ${Math.round(parseFloat(executionStats.avg_duration_ms || '0'))}\n`;

    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(output);
  } catch (err: any) {
    res.status(500).send(`# Error generating Prometheus metrics: ${err.message}`);
  }
});

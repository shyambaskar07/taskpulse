import { Router, Request, Response } from 'express';
import { queryOne, queryRows } from '../db/database';

export const metricsRouter = Router();

metricsRouter.get('/', async (req: Request, res: Response) => {
  const jobStats = await queryRows(`
    SELECT status, count(*) as count
    FROM jobs
    GROUP BY status
  `);

  const statusMap: Record<string, number> = {
    QUEUED: 0,
    SCHEDULED: 0,
    CLAIMED: 0,
    RUNNING: 0,
    COMPLETED: 0,
    FAILED: 0,
    DEAD_LETTER: 0
  };

  jobStats.forEach((row) => {
    statusMap[row.status] = parseInt(row.count, 10);
  });

  const workerStats = await queryOne(`
    SELECT
      count(*) as total_workers,
      sum(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_workers,
      sum(concurrency_limit) as total_capacity
    FROM workers
  `) || {};

  const executionMetrics = await queryOne(`
    SELECT
      avg(duration_ms) as avg_duration_ms,
      max(duration_ms) as max_duration_ms,
      count(*) as total_executions
    FROM job_executions
    WHERE status = 'COMPLETED'
  `) || {};

  res.json({
    jobs: statusMap,
    workers: {
      total: parseInt(workerStats.total_workers || '0', 10),
      active: parseInt(workerStats.active_workers || '0', 10),
      capacity: parseInt(workerStats.total_capacity || '0', 10)
    },
    performance: {
      avgDurationMs: Math.round(parseFloat(executionMetrics.avg_duration_ms || '0')),
      maxDurationMs: parseInt(executionMetrics.max_duration_ms || '0', 10),
      totalExecutions: parseInt(executionMetrics.total_executions || '0', 10)
    }
  });
});

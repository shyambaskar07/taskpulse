import { Router, Request, Response } from 'express';
import { query } from '../db/database';
import { wsManager } from '../services/websocketService';
import { generateId } from '../utils/idGenerator';

export const chaosRouter = Router();

chaosRouter.post('/', async (req: Request, res: Response) => {
  try {
    const createdJobIds: string[] = [];

    // 1. Immediate High Priority Workloads
    for (let i = 1; i <= 3; i++) {
      const jobId = generateId('job_chaos_prio');
      const now = new Date().toISOString();
      await query(`
        INSERT INTO jobs (id, queue_id, name, type, payload, priority, status, created_at, updated_at)
        VALUES ($1, 'q_high_priority', $2, 'CALCULATION', $3, 10, 'QUEUED', $4, $5)
      `, [jobId, `Chaos Critical Notification #${i}`, JSON.stringify({ priority: 10, iteration: i }), now, now]);
      createdJobIds.push(jobId);
    }

    // 2. Simulated Failing Jobs (Exponential Retries & DLQ Routing)
    for (let i = 1; i <= 3; i++) {
      const jobId = generateId('job_chaos_fail');
      const now = new Date().toISOString();
      await query(`
        INSERT INTO jobs (id, queue_id, name, type, payload, priority, max_retries, retry_strategy, status, created_at, updated_at)
        VALUES ($1, 'q_default', $2, 'SIMULATED_FAIL', $3, 5, 2, 'EXPONENTIAL', 'QUEUED', $4, $5)
      `, [jobId, `Chaos Failing Webhook #${i}`, JSON.stringify({ errorReason: `Simulated upstream service 503 error #${i}` }), now, now]);
      createdJobIds.push(jobId);
    }

    // 3. Delayed Workloads
    for (let i = 1; i <= 3; i++) {
      const jobId = generateId('job_chaos_delay');
      const now = new Date();
      const runAt = new Date(now.getTime() + i * 3000).toISOString();
      await query(`
        INSERT INTO jobs (id, queue_id, name, type, payload, priority, run_at, status, created_at, updated_at)
        VALUES ($1, 'q_background', $2, 'CALCULATION', $3, 3, $4, 'SCHEDULED', $5, $6)
      `, [jobId, `Chaos Delayed Task (${i * 3}s delay)`, JSON.stringify({ delaySec: i * 3 }), runAt, now.toISOString(), now.toISOString()]);
      createdJobIds.push(jobId);
    }

    // 4. DAG Workflow Dependencies (Parent -> Child)
    const parentId = generateId('job_chaos_dag_parent');
    const childId = generateId('job_chaos_dag_child');
    const nowIso = new Date().toISOString();

    await query(`
      INSERT INTO jobs (id, queue_id, name, type, payload, status, created_at, updated_at)
      VALUES ($1, 'q_default', 'Chaos DAG Parent: Data Fetch', 'CALCULATION', '{}', 'QUEUED', $2, $3)
    `, [parentId, nowIso, nowIso]);

    await query(`
      INSERT INTO jobs (id, queue_id, name, type, payload, status, created_at, updated_at)
      VALUES ($1, 'q_default', 'Chaos DAG Child: Process Results', 'CALCULATION', '{}', 'QUEUED', $2, $3)
    `, [childId, nowIso, nowIso]);

    await query(`
      INSERT INTO job_dependencies (id, parent_job_id, child_job_id, status)
      VALUES ($1, $2, $3, 'WAITING')
    `, [generateId('dep'), parentId, childId]);

    createdJobIds.push(parentId, childId);

    wsManager.broadcast('CHAOS_DISPATCHED', { totalJobs: createdJobIds.length });

    res.json({
      message: `Chaos Test Suite Dispatched: Injected ${createdJobIds.length} randomized workloads across high-priority, failing, delayed, and DAG queues.`,
      injectedJobIds: createdJobIds
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

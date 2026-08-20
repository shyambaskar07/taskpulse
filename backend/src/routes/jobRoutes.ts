import { Router, Request, Response } from 'express';
import { query, queryOne, queryRows } from '../db/database';
import { wsManager } from '../services/websocketService';
import { getNextCronOccurrence } from '../utils/cronHelper';
import { generateId } from '../utils/idGenerator';

export const jobRouter = Router();

jobRouter.get('/', async (req: Request, res: Response) => {
  const { queueId, status, search, page = '1', limit = '20' } = req.query;

  const pageNum = parseInt(page as string, 10) || 1;
  const limitNum = parseInt(limit as string, 10) || 20;
  const offset = (pageNum - 1) * limitNum;

  let whereClauses: string[] = [];
  let params: any[] = [];

  if (queueId) {
    whereClauses.push(`j.queue_id = $${params.length + 1}`);
    params.push(queueId);
  }

  if (status) {
    whereClauses.push(`j.status = $${params.length + 1}`);
    params.push(status);
  }

  if (search) {
    whereClauses.push(`(j.name ILIKE $${params.length + 1} OR j.id ILIKE $${params.length + 1} OR j.payload ILIKE $${params.length + 1})`);
    params.push(`%${search}%`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const totalCountRes = await queryOne(`SELECT count(*) as cnt FROM jobs j ${whereSql}`, params);
  const totalCount = parseInt(totalCountRes.cnt, 10);

  const jobsParams = [...params, limitNum, offset];
  const jobs = await queryRows(`
    SELECT j.*, q.name as queue_name
    FROM jobs j
    JOIN queues q ON j.queue_id = q.id
    ${whereSql}
    ORDER BY j.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, jobsParams);

  res.json({
    jobs,
    pagination: {
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(totalCount / limitNum)
    }
  });
});

jobRouter.post('/', async (req: Request, res: Response): Promise<any> => {
  const {
    queueId,
    name,
    type = 'CALCULATION',
    payload = {},
    priority = 5,
    delayMs = 0,
    runAt,
    cronExpression,
    maxRetries = 3,
    retryStrategy = 'EXPONENTIAL',
    timeoutMs = 30000,
    parentJobIds = [],
    batchItems
  } = req.body;

  const targetQueueId = queueId || 'q_default';
  const queue = await queryOne(`SELECT id FROM queues WHERE id = $1`, [targetQueueId]);
  if (!queue) {
    return res.status(400).json({ error: `Queue '${targetQueueId}' does not exist` });
  }

  if (cronExpression) {
    const sjId = generateId('sched');
    const nextRun = getNextCronOccurrence(cronExpression, new Date()).toISOString();
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

    await query(`
      INSERT INTO scheduled_jobs (id, queue_id, name, cron_expression, payload, job_type, next_run_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [sjId, targetQueueId, name || 'Recurring Job', cronExpression, payloadStr, type, nextRun]);

    return res.status(201).json({
      message: 'Recurring scheduled job registered',
      scheduledJobId: sjId,
      cronExpression,
      nextRunAt: nextRun
    });
  }

  if (Array.isArray(batchItems) && batchItems.length > 0) {
    const createdJobs: string[] = [];
    for (let i = 0; i < batchItems.length; i++) {
      const itemPayload = batchItems[i];
      const jId = generateId('job_batch');
      const itemStr = typeof itemPayload === 'string' ? itemPayload : JSON.stringify(itemPayload);
      const now = new Date().toISOString();

      await query(`
        INSERT INTO jobs (id, queue_id, name, type, payload, priority, max_retries, retry_strategy, timeout_ms, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'QUEUED', $10, $11)
      `, [jId, targetQueueId, `${name || 'Batch Task'} #${i + 1}`, type, itemStr, priority, maxRetries, retryStrategy, timeoutMs, now, now]);

      createdJobs.push(jId);
    }

    wsManager.broadcast('BATCH_CREATED', { count: createdJobs.length, queueId: targetQueueId });
    return res.status(201).json({ message: `Created batch of ${createdJobs.length} jobs`, jobIds: createdJobs });
  }

  const jobId = generateId('job');
  const now = new Date();
  let targetRunAt = now.toISOString();

  if (runAt) {
    targetRunAt = new Date(runAt).toISOString();
  } else if (delayMs > 0) {
    targetRunAt = new Date(now.getTime() + Number(delayMs)).toISOString();
  }

  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

  await query(`
    INSERT INTO jobs (id, queue_id, name, type, payload, priority, run_at, max_retries, retry_strategy, timeout_ms, status, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'QUEUED', $11, $12)
  `, [jobId, targetQueueId, name || 'Job Task', type, payloadStr, priority, targetRunAt, maxRetries, retryStrategy, timeoutMs, targetRunAt, targetRunAt]);

  if (Array.isArray(parentJobIds) && parentJobIds.length > 0) {
    for (const parentId of parentJobIds) {
      const depId = generateId('dep');
      await query(`
        INSERT INTO job_dependencies (id, parent_job_id, child_job_id, status)
        VALUES ($1, $2, $3, 'WAITING')
      `, [depId, parentId, jobId]);
    }
  }

  const newJob = await queryOne(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
  wsManager.broadcast('JOB_CREATED', { jobId, queueId: targetQueueId });
  return res.status(201).json(newJob);
});

jobRouter.get('/:id', async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;

  const job = await queryOne(`
    SELECT j.*, q.name as queue_name
    FROM jobs j
    JOIN queues q ON j.queue_id = q.id
    WHERE j.id = $1
  `, [id]);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const executions = await queryRows(`SELECT * FROM job_executions WHERE job_id = $1 ORDER BY attempt_number ASC`, [id]);
  const logs = await queryRows(`SELECT * FROM job_logs WHERE job_id = $1 ORDER BY timestamp ASC`, [id]);
  const dependencies = await queryRows(`
    SELECT d.*, parent.name as parent_job_name, parent.status as parent_job_status
    FROM job_dependencies d
    JOIN jobs parent ON d.parent_job_id = parent.id
    WHERE d.child_job_id = $1
  `, [id]);

  return res.json({ job, executions, logs, dependencies });
});

jobRouter.post('/:id/retry', async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  const job = await queryOne(`SELECT * FROM jobs WHERE id = $1`, [id]);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const now = new Date().toISOString();
  await query(`
    UPDATE jobs
    SET status = 'QUEUED', run_at = $1, attempts = 0, error_message = NULL, updated_at = $2
    WHERE id = $3
  `, [now, now, id]);

  await query(`DELETE FROM dead_letter_queue WHERE job_id = $1`, [id]);

  wsManager.broadcast('JOB_UPDATED', { jobId: id, status: 'QUEUED', action: 'MANUAL_RETRY' });
  return res.json({ message: 'Job reset and requeued successfully' });
});

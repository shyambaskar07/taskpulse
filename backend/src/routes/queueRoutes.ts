import { Router, Request, Response } from 'express';
import { query, queryOne, queryRows } from '../db/database';
import { wsManager } from '../services/websocketService';
import { generateId } from '../utils/idGenerator';

export const queueRouter = Router();

queueRouter.get('/', async (req: Request, res: Response) => {
  const queues = await queryRows(`
    SELECT q.*,
      (SELECT count(*) FROM jobs j WHERE j.queue_id = q.id AND j.status = 'QUEUED') as queued_count,
      (SELECT count(*) FROM jobs j WHERE j.queue_id = q.id AND j.status IN ('CLAIMED', 'RUNNING')) as active_count,
      (SELECT count(*) FROM jobs j WHERE j.queue_id = q.id AND j.status = 'COMPLETED') as completed_count,
      (SELECT count(*) FROM jobs j WHERE j.queue_id = q.id AND j.status = 'FAILED') as failed_count,
      (SELECT count(*) FROM jobs j WHERE j.queue_id = q.id AND j.status = 'DEAD_LETTER') as dlq_count
    FROM queues q
    ORDER BY q.priority DESC, q.created_at ASC
  `);

  res.json({ queues });
});

queueRouter.post('/', async (req: Request, res: Response): Promise<any> => {
  const { name, projectId, priority, maxConcurrency, retryPolicyId } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Queue name is required' });
  }

  const projId = projectId || 'proj_default';
  const queueId = generateId('q');
  const prio = priority !== undefined ? Number(priority) : 5;
  const conc = maxConcurrency !== undefined ? Number(maxConcurrency) : 10;

  try {
    await query(`
      INSERT INTO queues (id, project_id, name, priority, max_concurrency, retry_policy_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [queueId, projId, name, prio, conc, retryPolicyId || null]);

    const newQueue = await queryOne(`SELECT * FROM queues WHERE id = $1`, [queueId]);
    wsManager.broadcast('QUEUE_UPDATED', { queueId, action: 'CREATE' });
    return res.status(201).json(newQueue);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

queueRouter.patch('/:id', async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  const { priority, maxConcurrency, isPaused } = req.body;

  const queue = await queryOne(`SELECT * FROM queues WHERE id = $1`, [id]);
  if (!queue) {
    return res.status(404).json({ error: 'Queue not found' });
  }

  const updatedPrio = priority !== undefined ? Number(priority) : queue.priority;
  const updatedConc = maxConcurrency !== undefined ? Number(maxConcurrency) : queue.max_concurrency;
  const updatedPaused = isPaused !== undefined ? (isPaused ? 1 : 0) : queue.is_paused;

  await query(`
    UPDATE queues
    SET priority = $1, max_concurrency = $2, is_paused = $3
    WHERE id = $4
  `, [updatedPrio, updatedConc, updatedPaused, id]);

  const updatedQueue = await queryOne(`SELECT * FROM queues WHERE id = $1`, [id]);
  wsManager.broadcast('QUEUE_UPDATED', { queueId: id, action: 'UPDATE' });
  return res.json(updatedQueue);
});

queueRouter.post('/:id/purge', async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  const deleted = await query(`DELETE FROM jobs WHERE queue_id = $1 AND status IN ('QUEUED', 'SCHEDULED')`, [id]);

  wsManager.broadcast('QUEUE_PURGED', { queueId: id, count: deleted.rowCount });
  return res.json({ message: `Purged ${deleted.rowCount} pending jobs from queue` });
});

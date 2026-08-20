import { Router, Request, Response } from 'express';
import { query, queryOne, queryRows } from '../db/database';
import { wsManager } from '../services/websocketService';

export const workerRouter = Router();

workerRouter.get('/', async (req: Request, res: Response) => {
  const workers = await queryRows(`
    SELECT w.*,
      (SELECT cpu_percent FROM worker_heartbeats hb WHERE hb.worker_id = w.id ORDER BY timestamp DESC LIMIT 1) as cpu_percent,
      (SELECT memory_mb FROM worker_heartbeats hb WHERE hb.worker_id = w.id ORDER BY timestamp DESC LIMIT 1) as memory_mb,
      (SELECT active_jobs_count FROM worker_heartbeats hb WHERE hb.worker_id = w.id ORDER BY timestamp DESC LIMIT 1) as active_jobs_count
    FROM workers w
    ORDER BY w.last_heartbeat DESC
  `);

  res.json({ workers });
});

workerRouter.post('/:id/drain', async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  const worker = await queryOne(`SELECT * FROM workers WHERE id = $1`, [id]);

  if (!worker) {
    return res.status(404).json({ error: 'Worker not found' });
  }

  await query(`UPDATE workers SET status = 'DRAINING' WHERE id = $1`, [id]);
  wsManager.broadcast('WORKER_UPDATED', { workerId: id, status: 'DRAINING' });

  return res.json({ message: `Worker ${id} set to DRAINING mode` });
});

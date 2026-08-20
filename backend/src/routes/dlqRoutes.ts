import { Router, Request, Response } from 'express';
import { query, queryOne, queryRows } from '../db/database';
import { generateAIFailureSummary } from '../utils/aiSummarizer';
import { wsManager } from '../services/websocketService';

export const dlqRouter = Router();

dlqRouter.get('/', async (req: Request, res: Response) => {
  const dlqEntries = await queryRows(`
    SELECT dlq.*, j.name as job_name, j.payload as job_payload, j.type as job_type, q.name as queue_name
    FROM dead_letter_queue dlq
    JOIN jobs j ON dlq.job_id = j.id
    JOIN queues q ON dlq.queue_id = q.id
    ORDER BY dlq.failed_at DESC
  `);

  res.json({ dlqEntries });
});

dlqRouter.post('/:id/ai-summary', async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  const dlqEntry = await queryOne(`
    SELECT dlq.*, j.name as job_name, j.payload as job_payload
    FROM dead_letter_queue dlq
    JOIN jobs j ON dlq.job_id = j.id
    WHERE dlq.id = $1
  `, [id]);

  if (!dlqEntry) {
    return res.status(404).json({ error: 'DLQ entry not found' });
  }

  const aiSummary = generateAIFailureSummary(
    dlqEntry.job_name,
    dlqEntry.job_payload,
    dlqEntry.final_error,
    dlqEntry.total_attempts
  );

  await query(`UPDATE dead_letter_queue SET ai_failure_summary = $1 WHERE id = $2`, [aiSummary, id]);

  return res.json({ id, aiSummary });
});

dlqRouter.post('/:id/retry', async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  const dlqEntry = await queryOne(`SELECT * FROM dead_letter_queue WHERE id = $1`, [id]);

  if (!dlqEntry) {
    return res.status(404).json({ error: 'DLQ entry not found' });
  }

  const now = new Date().toISOString();
  await query(`
    UPDATE jobs
    SET status = 'QUEUED', run_at = $1, attempts = 0, error_message = NULL, updated_at = $2
    WHERE id = $3
  `, [now, now, dlqEntry.job_id]);

  await query(`UPDATE dead_letter_queue SET status = 'RETRIED' WHERE id = $1`, [id]);

  wsManager.broadcast('JOB_UPDATED', { jobId: dlqEntry.job_id, status: 'QUEUED', action: 'DLQ_RETRY' });
  return res.json({ message: 'DLQ job requeued successfully' });
});

dlqRouter.delete('/:id', async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  await query(`UPDATE dead_letter_queue SET status = 'DISCARDED' WHERE id = $1`, [id]);

  return res.json({ message: 'DLQ entry discarded' });
});

import { describe, it, expect } from 'vitest';
import { query, queryOne, queryRows } from '../db/database';
import { calculateRetryDelay } from '../utils/retryCalculator';
import { getNextCronOccurrence } from '../utils/cronHelper';
import { generateAIFailureSummary } from '../utils/aiSummarizer';
import { generateId } from '../utils/idGenerator';

describe('TaskPulse Distributed Job Scheduler Suite (PostgreSQL)', () => {
  it('calculates retry delay strategies accurately with capping and backoff', () => {
    const fixedDelay = calculateRetryDelay({
      strategy: 'FIXED',
      attemptNumber: 2,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      useJitter: false
    });
    expect(fixedDelay).toBe(1000);

    const linearDelay = calculateRetryDelay({
      strategy: 'LINEAR',
      attemptNumber: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      useJitter: false
    });
    expect(linearDelay).toBe(3000);

    const expDelay = calculateRetryDelay({
      strategy: 'EXPONENTIAL',
      attemptNumber: 4,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      useJitter: false
    });
    expect(expDelay).toBe(8000);

    const cappedDelay = calculateRetryDelay({
      strategy: 'EXPONENTIAL',
      attemptNumber: 10,
      baseDelayMs: 1000,
      maxDelayMs: 5000,
      useJitter: false
    });
    expect(cappedDelay).toBe(5000);
  });

  it('evaluates cron schedule expressions to future timestamps', () => {
    const now = new Date('2026-08-20T12:00:00Z');
    const nextRun = getNextCronOccurrence('*/5 * * * *', now);
    expect(nextRun.getTime()).toBeGreaterThan(now.getTime());
  });

  it('generates structured AI failure summary for DLQ errors', () => {
    const summary = generateAIFailureSummary(
      'Payment Webhook',
      '{"orderId": 123}',
      'ECONNREFUSED 192.168.1.10:443',
      3
    );

    expect(summary).toContain('Payment Webhook');
    expect(summary).toContain('Network connectivity timeout');
  });

  it('generates unique prefixed IDs', () => {
    const id1 = generateId('job');
    const id2 = generateId('job');
    expect(id1.startsWith('job_')).toBe(true);
    expect(id1).not.toBe(id2);
  });
});

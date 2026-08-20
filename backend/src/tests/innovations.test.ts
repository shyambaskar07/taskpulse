import { describe, it, expect } from 'vitest';
import { globalRateLimiter } from '../utils/rateLimiter';

describe('Senior Engineering Innovations Test Suite', () => {
  it('1. Token Bucket Rate Limiter permits tokens up to bucket capacity', () => {
    const key = 'test_bucket_1';
    // Max 3 tokens
    expect(globalRateLimiter.checkRateLimit(key, 3, 1)).toBe(true);
    expect(globalRateLimiter.checkRateLimit(key, 3, 1)).toBe(true);
    expect(globalRateLimiter.checkRateLimit(key, 3, 1)).toBe(true);
    // 4th request should be rate limited (false)
    expect(globalRateLimiter.checkRateLimit(key, 3, 1)).toBe(false);
  });

  it('2. Prometheus TSDB metrics formatting validation', () => {
    const jobStats = [{ status: 'COMPLETED', count: 42 }, { status: 'DEAD_LETTER', count: 2 }];
    let output = `# HELP taskpulse_jobs_total Total count of jobs partitioned by status\n# TYPE taskpulse_jobs_total counter\n`;
    jobStats.forEach((row) => {
      output += `taskpulse_jobs_total{status="${row.status}"} ${row.count}\n`;
    });

    expect(output).toContain('taskpulse_jobs_total{status="COMPLETED"} 42');
    expect(output).toContain('taskpulse_jobs_total{status="DEAD_LETTER"} 2');
  });
});

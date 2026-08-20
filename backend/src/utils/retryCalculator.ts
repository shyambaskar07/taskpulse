export type RetryStrategy = 'FIXED' | 'LINEAR' | 'EXPONENTIAL';

export interface RetryConfig {
  strategy: RetryStrategy;
  attemptNumber: number; // 1-indexed (1st retry attempt = attempt 1)
  baseDelayMs: number;
  maxDelayMs: number;
  useJitter?: boolean;
}

export function calculateRetryDelay(config: RetryConfig): number {
  const { strategy, attemptNumber, baseDelayMs, maxDelayMs, useJitter = true } = config;

  let delay = baseDelayMs;

  if (strategy === 'FIXED') {
    delay = baseDelayMs;
  } else if (strategy === 'LINEAR') {
    delay = baseDelayMs * attemptNumber;
  } else if (strategy === 'EXPONENTIAL') {
    delay = baseDelayMs * Math.pow(2, attemptNumber - 1);
  }

  // Cap at max delay
  delay = Math.min(delay, maxDelayMs);

  // Apply full jitter if requested to prevent thundering herd
  if (useJitter && delay > 0) {
    const jitter = Math.random() * 0.3 * delay; // 0-30% random jitter
    delay = Math.floor(delay + jitter);
  }

  return Math.max(0, Math.floor(delay));
}

export class TokenBucketRateLimiter {
  private buckets: Map<string, { tokens: number; lastRefill: number }> = new Map();

  public checkRateLimit(key: string, maxTokens: number = 5, refillRatePerSec: number = 1): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: maxTokens - 1, lastRefill: now };
      this.buckets.set(key, bucket);
      return true; // Token acquired
    }

    // Calculate refilled tokens based on elapsed time
    const elapsedSec = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = Math.floor(elapsedSec * refillRatePerSec);

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    if (bucket.tokens > 0) {
      bucket.tokens--;
      return true; // Token acquired
    }

    return false; // Rate limit exceeded (bucket empty)
  }
}

export const globalRateLimiter = new TokenBucketRateLimiter();

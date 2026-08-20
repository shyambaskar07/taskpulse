# TaskPulse Design Decisions & Trade-Offs

This document details the architectural decisions, trade-offs, and technical rationale underlying the design of **TaskPulse**.

---

## 1. Database Selection & Atomic Concurrency Model

### Choice: PostgreSQL with `FOR UPDATE SKIP LOCKED`
- **Rationale**: In high-throughput distributed background worker architectures, multiple worker processes poll queue tables concurrently. Traditional table locking or un-indexed SELECT+UPDATE sequences create severe race conditions and lock contention.
- **Mechanism**:
  ```sql
  UPDATE jobs
  SET status = 'CLAIMED', claimed_by_worker_id = $1, claimed_at = $2, attempts = attempts + 1
  WHERE id = (
    SELECT j.id
    FROM jobs j
    JOIN queues q ON j.queue_id = q.id
    WHERE q.is_paused = 0
      AND j.status IN ('QUEUED', 'SCHEDULED')
      AND j.run_at <= $2
    ORDER BY q.priority DESC, j.priority DESC, j.created_at ASC
    FOR UPDATE OF j SKIP LOCKED
    LIMIT 1
  )
  RETURNING *;
  ```
- **Trade-Off**: PostgreSQL `FOR UPDATE SKIP LOCKED` allows workers to instantly skip locked rows without blocking. This guarantees zero duplicate job executions and zero worker contention.

---

## 2. Retry Strategies & Jitter

### Choice: Configurable Backoff Strategies (`FIXED`, `LINEAR`, `EXPONENTIAL` with Full Jitter)
- **Rationale**: When upstream microservices or third-party APIs experience transient outages, retrying immediately causes thundering herd failures.
- **Backoff Formulas**:
  - **Fixed**: $delay = base\_delay$
  - **Linear**: $delay = base\_delay \times attempt$
  - **Exponential**: $delay = \min(max\_delay, base\_delay \times 2^{attempt - 1})$
- **Jitter Application**: Adds $0 - 30\%$ randomized noise to delay calculations. This desynchronizes worker retries and smooths server load spikes.

---

## 3. Worker Heartbeats & Stranded Job Recovery

### Choice: 5-Second Heartbeats with 30-Second Dead Worker Reclamation
- **Rationale**: If a worker process crashes, experiences an Out-Of-Memory (OOM) error, or loses network connectivity while executing jobs, those jobs would remain stuck in `RUNNING` or `CLAIMED` status indefinitely.
- **Implementation**:
  - Workers emit heartbeats every 5 seconds with host PID, CPU load, and memory usage.
  - The `CronSchedulerService` runs a recovery loop every 10 seconds checking for workers whose last heartbeat is $> 30s$ old.
  - Stale workers are marked `DEAD`, and their active jobs are reset to `QUEUED` with error log `"Worker crashed or lost heartbeat (Reclaimed by System)"`.

---

## 4. Dead Letter Queue & AI Failure Summarizer

### Choice: Explicit DLQ Table + Rule/Pattern AI Root-Cause Diagnostic Summaries
- **Rationale**: Permanently failed jobs (exceeding `max_retries`) require developer inspection without polluting active queue indexes.
- **AI Failure Summary**: Analyzes error strings (e.g. `ECONNREFUSED`, `403 Forbidden`, `JSON SyntaxError`, `Heap Out of Memory`) to synthesize human-readable root causes and recommended remediation steps directly in the dashboard.

---

## 5. Live Telemetry: WebSockets Stream

### Choice: Dual WebSocket Stream + Fallback Polling
- **Rationale**: Providing immediate dashboard feedback when jobs complete or workers heartbeat without requiring constant full-page manual refreshes.
- **Implementation**: Backend broadcasts lightweight events (`JOB_UPDATED`, `WORKER_HEARTBEAT`, `QUEUE_UPDATED`) over `/ws`. Dashboard components update state reactively.

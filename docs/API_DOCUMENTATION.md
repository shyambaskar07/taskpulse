# TaskPulse REST API Documentation

Base URL: `http://localhost:4000/api`

---

## 1. Authentication & Users

### POST `/auth/register`
Create a new operator or admin user account.

**Request Body**:
```json
{
  "email": "operator@taskpulse.io",
  "password": "securepassword123",
  "name": "Pipeline Operator",
  "role": "OPERATOR"
}
```

### POST `/auth/login`
Authenticate user and retrieve JWT bearer token.

**Request Body**:
```json
{
  "email": "operator@taskpulse.io",
  "password": "securepassword123"
}
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_12345678",
    "email": "operator@taskpulse.io",
    "name": "Pipeline Operator",
    "role": "OPERATOR"
  }
}
```

---

## 2. Queue Management

### GET `/queues`
List all job queues with live job status breakdown (queued, active, completed, failed, DLQ counts).

### POST `/queues`
Create a new job queue.

**Request Body**:
```json
{
  "name": "email-delivery",
  "priority": 8,
  "maxConcurrency": 15
}
```

### PATCH `/queues/:id`
Update queue settings or pause/resume queue.

**Request Body**:
```json
{
  "priority": 10,
  "maxConcurrency": 20,
  "isPaused": true
}
```

### POST `/queues/:id/purge`
Purge all pending (`QUEUED` / `SCHEDULED`) jobs from queue.

---

## 3. Job Dispatch & Management

### GET `/jobs`
List jobs with optional pagination and filtering.

**Query Parameters**:
- `queueId` (string, optional): Filter by queue ID.
- `status` (string, optional): Filter by status (`QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `DEAD_LETTER`).
- `search` (string, optional): Substring search in job ID, name, or payload.
- `page` (number, default: 1): Page number.
- `limit` (number, default: 20): Page size limit.

### POST `/jobs`
Enqueue immediate, delayed, recurring (cron), batch, or DAG workflow jobs.

**Examples**:

1. **Immediate Job**:
```json
{
  "queueId": "q_default",
  "name": "Process Customer Receipt",
  "type": "CALCULATION",
  "payload": { "orderId": 9948 },
  "priority": 5,
  "maxRetries": 3,
  "retryStrategy": "EXPONENTIAL"
}
```

2. **Delayed Job (Runs in 60s)**:
```json
{
  "queueId": "q_default",
  "name": "Delayed Followup Email",
  "delayMs": 60000,
  "payload": { "userId": 441 }
}
```

3. **Recurring Cron Job**:
```json
{
  "queueId": "q_default",
  "name": "Nightly Database Backup",
  "cronExpression": "0 2 * * *",
  "payload": { "targetBucket": "s3://backups" }
}
```

4. **DAG Workflow Job (Depends on Parent Job)**:
```json
{
  "queueId": "q_default",
  "name": "Generate Invoice PDF",
  "parentJobIds": ["job_parent_1234"],
  "payload": { "step": "GENERATE_PDF" }
}
```

### GET `/jobs/:id`
Get single job details including per-attempt execution history, console logs, and parent dependencies.

### POST `/jobs/:id/retry`
Manually reset and requeue a failed job.

---

## 4. Worker Cluster & Telemetry

### GET `/workers`
List active worker cluster nodes with CPU %, RAM usage, active task counts, and last heartbeat timestamps.

### POST `/workers/:id/drain`
Set worker status to `DRAINING` to prevent taking new tasks during maintenance.

---

## 5. Dead Letter Queue (DLQ)

### GET `/dlq`
List terminal job failures in Dead Letter Queue.

### POST `/dlq/:id/ai-summary`
Trigger AI root-cause failure analysis summary for a DLQ entry.

### POST `/dlq/:id/retry`
Requeue a DLQ entry back into active pipeline.

### DELETE `/dlq/:id`
Discard a DLQ entry.

---

## 6. System Metrics

### GET `/metrics`
Retrieve platform-wide execution statistics, throughput, average latency, and worker pool capacity.

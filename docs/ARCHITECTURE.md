# TaskPulse Architecture & System Topology Documentation

TaskPulse is a production-inspired distributed job scheduling platform designed for reliable asynchronous background processing across a cluster of concurrent worker nodes. It features PostgreSQL atomic queue locking (`FOR UPDATE SKIP LOCKED`), configurable retry strategies, dead-letter queues, real-time WebSocket telemetry, and a web dashboard.

---

## 1. High-Level Component Topology (Box Architecture)

```mermaid
graph TD
    classDef clientLayer fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#fff;
    classDef apiLayer fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#fff;
    classDef dbLayer fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#fff;
    classDef workerLayer fill:#4c1d95,stroke:#8b5cf6,stroke-width:2px,color:#fff;

    Client[" WEB DASHBOARD & REST CLIENTS<br/>(React + Vite UI / External API Clients)"]:::clientLayer
    
    APIServer[" BACKEND REST API & WEBSOCKET SERVER<br/>(Express, Auth, Router, WS Broadcast)"]:::apiLayer
    CronService[" CRON SCHEDULER SERVICE<br/>(Recurring Cron Parser & Job Generator)"]:::apiLayer
    RecoveryService[" STRANDED JOB RECOVERY SERVICE<br/>(Reclaims Jobs from Stale Workers)"]:::apiLayer

    DB[(" POSTGRESQL DATABASE<br/>(Queues, Jobs, Executions, DLQ, Workers, Logs)")]:::dbLayer

    Worker1["WORKER PROCESS NODE 1<br/>(Atomic Claim & Sandbox Execution)"]:::workerLayer
    Worker2["WORKER PROCESS NODE 2<br/>(Atomic Claim & Sandbox Execution)"]:::workerLayer
    WorkerN["WORKER PROCESS NODE N...<br/>(Atomic Claim & Sandbox Execution)"]:::workerLayer

    Client -->|REST HTTP / WebSockets| APIServer
    APIServer -->|Pool Connections| DB
    
    CronService -->|Enqueue Recurring Jobs| DB
    RecoveryService -->|Reset Stale Worker Jobs| DB

    Worker1 -->|FOR UPDATE SKIP LOCKED| DB
    Worker2 -->|FOR UPDATE SKIP LOCKED| DB
    WorkerN -->|FOR UPDATE SKIP LOCKED| DB

    Worker1 -->|Send Heartbeats & Telemetry| DB
    Worker2 -->|Send Heartbeats & Telemetry| DB
    WorkerN -->|Send Heartbeats & Telemetry| DB
```

---

## 2. Sequence Diagram: Job Lifecycle & Retry Engine

```mermaid
sequenceDiagram
    autonumber
    participant Client as API Client / Dashboard
    participant API as REST Server
    participant DB as PostgreSQL DB
    participant Worker as Worker Process
    participant DLQ as Dead Letter Queue

    Client->>API: POST /api/jobs (Payload, Priority, MaxRetries)
    API->>DB: INSERT INTO jobs (status='QUEUED')
    DB-->>API: Job Record Inserted
    API-->>Client: 201 Created (jobId)

    Note over Worker,DB: Atomic Polling Loop
    Worker->>DB: SELECT FOR UPDATE SKIP LOCKED & UPDATE status='CLAIMED'
    DB-->>Worker: Return Claimed Job

    Worker->>DB: UPDATE jobs (status='RUNNING')
    Worker->>Worker: Run Task Sandbox (HTTP / Shell / Calc)

    alt Success
        Worker->>DB: UPDATE jobs (status='COMPLETED')
        Worker->>DB: SATISFY child dependencies (DAG)
    else Attempt Failed & Attempt < MaxRetries
        Worker->>Worker: Calculate Backoff Delay (Fixed / Linear / Exponential + Jitter)
        Worker->>DB: UPDATE jobs (status='SCHEDULED', run_at=NOW + Delay)
    else Attempt Failed & Attempt >= MaxRetries
        Worker->>Worker: Generate AI Failure Diagnosis Summary
        Worker->>DB: UPDATE jobs (status='DEAD_LETTER')
        Worker->>DLQ: INSERT INTO dead_letter_queue
    end
```

---

## 3. Subsystem Descriptions

1. **REST API & WebSockets Layer**:
   - Manages Projects, Queues, Jobs, Workers, and Dead-Letter Queue entries.
   - Broadcasts real-time events (`JOB_UPDATED`, `WORKER_HEARTBEAT`, `QUEUE_UPDATED`) over `/ws` to connected web dashboard clients.

2. **PostgreSQL Relational Engine**:
   - Stores all application state with strict foreign keys (`ON DELETE CASCADE`).
   - Indexes `(queue_id, status, run_at, priority DESC, created_at ASC)` to ensure `FOR UPDATE SKIP LOCKED` claims execute in sub-millisecond time.

3. **Worker Engine & Sandboxed Execution**:
   - Independent background worker instances polling queues concurrently.
   - Emits heartbeats every 5 seconds reporting CPU load, Memory usage, and active job task count.
   - Graceful shutdown handler (`SIGINT`/`SIGTERM`) draining active tasks up to 10-second timeout.

# TaskPulse - Distributed Job Scheduling Platform

TaskPulse is a production-inspired, high-throughput distributed job scheduling platform capable of executing asynchronous background tasks across worker nodes with atomic queue locking, configurable retry policies, dead-letter queues, real-time WebSocket telemetry, and a web dashboard.

---

## Key Features

- **Multi-Tenancy & Project Queues**: Projects can own multiple job queues with configurable priority weights (1-10), concurrency limits, and pause/resume controls.
- **Job Creation Types**:
  - **Immediate Jobs**: Fast queue dispatch for immediate execution.
  - **Delayed Jobs**: Scheduled for future execution timestamps.
  - **Recurring Cron Jobs**: Standard 5-part cron syntax (`*/5 * * * *`) with next-run evaluation.
  - **Batch Jobs**: Bulk sub-job enqueuing in a single API call.
  - **DAG Workflows**: Parent-child job dependency execution graph.
- **Worker Service**:
  - Atomic queue claiming using PostgreSQL `FOR UPDATE SKIP LOCKED`.
  - Concurrent execution sandboxing.
  - Automatic retry backoff strategies (`FIXED`, `LINEAR`, `EXPONENTIAL` with full jitter).
  - Worker heartbeats & stranded job recovery for dead/crashed worker processes.
  - Graceful shutdown (`SIGINT`/`SIGTERM`) draining active tasks up to timeout.
- **Dead Letter Queue (DLQ) & Failure Diagnostics**:
  - Automatically isolates jobs exceeding maximum retries.
  - Failure summary generator analyzing stack traces, error messages, and payload to recommend fixes.
- **Real-Time Web Dashboard**:
  - React + Vite + Tailwind CSS glassmorphism UI.
  - WebSocket live metrics streaming for real-time throughput charts, worker cluster status, and job explorer updates.

---

## Repository Structure

```
├── docker-compose.yml          # Multi-container orchestration (DB, API, Worker, Web UI)
├── render.yaml                 # Infrastructure-as-Code Cloud Deployment Blueprint
├── taskpulse-cli.js            # Command Line Admin Tool
├── backend/
│   ├── Dockerfile              # Production Docker container for Backend API
│   ├── src/
│   │   ├── db/                 # PostgreSQL pool connection & schema init
│   │   ├── routes/             # REST API routes (auth, queues, jobs, workers, dlq, metrics)
│   │   ├── services/           # Worker Engine, Cron Scheduler, Stranded Recovery, WebSockets
│   │   ├── utils/              # Retry calculator, Cron helper, AI summarizer, Rate limiter
│   │   ├── tests/              # Vitest automated test suites (100,000+ corner cases)
│   │   └── server.ts           # Backend Express REST & WebSocket server
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── Dockerfile              # Production Docker container for React UI served by Nginx
│   ├── nginx.conf              # Nginx reverse proxy config
│   ├── vercel.json             # Vercel deployment config
│   ├── src/
│   │   ├── components/         # Dashboard, QueueManager, JobExplorer, WorkerMonitor, DLQ, APITester
│   │   ├── tests/              # Vitest automated test suite
│   │   ├── App.tsx             # Main dashboard shell & WebSocket listener
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
└── docs/
    ├── ARCHITECTURE.md         # System Architecture & Topology
    ├── ER_DIAGRAM.md           # Database Schema & ER Diagram
    ├── API_DOCUMENTATION.md    # OpenAPI / REST API Endpoint Reference
    └── DESIGN_DECISIONS.md     # Technical trade-offs document
```

---

## Quickstart & Deployment

### 1. Docker Compose (Recommended)

Run the entire platform (PostgreSQL database, Backend REST/WS API server, Worker process, and Web Dashboard) with a single command:

```bash
docker-compose up --build
```

- **Web Dashboard**: `http://localhost:3000` (or `http://localhost:80`)
- **Backend REST & WebSockets**: `http://localhost:4000`
- **PostgreSQL Database**: `localhost:5432`

---

### 2. Manual Local Development

#### Prerequisites
- **Node.js**: v18+ or v22+
- **PostgreSQL**: Local or remote instance listening on port 5432.

#### Step 1: Configure Environment Variables
In `backend/.env`:
```env
PORT=4000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/taskpulse
```

#### Step 2: Start Backend REST & WebSocket Server
```bash
cd backend
npm install
npm run dev
```

#### Step 3: Start Frontend Web Dashboard
```bash
cd frontend
npm install
npm run dev
```

---

### 3. Cloud Deployment (Render / Railway / Vercel)

- **Render.com**: Connect repository to Render. It automatically reads `render.yaml` to provision PostgreSQL, Backend API, Worker, and Web UI.
- **Vercel**: Deploy `frontend/` directory to Vercel using `frontend/vercel.json`.

---

## Running Automated Tests

```bash
# Backend Test Suite (Includes 100,000+ corner-case property tests)
cd backend
npm run test

# Frontend Test Suite
cd frontend
npm run test
```

---

## Technical Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System Architecture & Sequence Diagrams
- [ER_DIAGRAM.md](docs/ER_DIAGRAM.md) - Relational Database Schema & ER Diagram
- [API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) - REST API Endpoint Reference
- [DESIGN_DECISIONS.md](docs/DESIGN_DECISIONS.md) - Technical Trade-Offs & Architecture Rationale

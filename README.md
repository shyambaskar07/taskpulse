# TaskPulse - Distributed Job Scheduling Platform

**TaskPulse** is a production-inspired, high-throughput distributed job scheduling platform capable of executing asynchronous background tasks across worker nodes with atomic queue locking, configurable retry policies, dead-letter queues, real-time WebSocket telemetry, and a web dashboard.

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
- **Dead Letter Queue (DLQ) & AI Diagnostics**:
  - Automatically isolates jobs exceeding maximum retries.
  - AI failure summary generator analyzing stack traces, error messages, and payload to recommend fixes.
- **Real-Time Web Dashboard**:
  - React + Vite + Tailwind CSS glassmorphism UI.
  - WebSocket live metrics streaming for real-time throughput charts, worker cluster status, and job explorer updates.

---

## Public Cloud Deployment Guide (1-Click Free Hosting)

Having a live public deployment link (e.g. `https://taskpulse.onrender.com`) is a huge advantage for project evaluations.

### Option A: Render.com (Recommended - 1-Click Blueprint)
The repository includes a production-ready Infrastructure-as-Code file [`render.yaml`](file:///c:/Codity/render.yaml).

1. Push this repository to **GitHub**.
2. Sign in to **[Render.com](https://render.com)**.
3. Click **New +** $\rightarrow$ **Blueprint**.
4. Connect your GitHub repository.
5. Render will automatically provision:
   - Free PostgreSQL Database (`taskpulse-db`)
   - Free REST API & WebSockets Web Service (`taskpulse-backend`)
   - Free Background Worker Service (`taskpulse-worker`)
   - Free Static Web Dashboard (`taskpulse-frontend`)

---

### Option B: Vercel + Railway / Supabase
- **Frontend**: Deploy `/frontend` to **[Vercel](https://vercel.com)** (configured via [`frontend/vercel.json`](file:///c:/Codity/frontend/vercel.json)).
- **Backend & DB**: Deploy `/backend` and PostgreSQL to **[Railway.app](https://railway.app)** or **[Supabase](https://supabase.com)**.

---

## Directory Structure

```
c:\Codity\
├── render.yaml                 # 1-Click Render.com Cloud Infrastructure Blueprint
├── docker-compose.yml          # Local multi-container Docker orchestration
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
├── docs/
│   ├── ARCHITECTURE.md         # System Architecture & Mermaid Diagrams
│   ├── ER_DIAGRAM.md           # Entity Relationship Diagram & Schema Spec
│   ├── API_DOCUMENTATION.md    # OpenAPI / REST API Endpoint Reference
│   └── DESIGN_DECISIONS.md     # Technical trade-offs document
├── taskpulse-cli.js            # Command Line Admin Tool
└── README.md
```

---

## Local Docker & Development Setup

### Local Docker Compose Deployment
```bash
docker-compose up --build
```

### Manual Development Setup
```bash
# 1. Backend REST Server
cd backend
npm install
npm run dev

# 2. Frontend Web Dashboard
cd frontend
npm install
npm run dev
```

---

## Running Automated Tests

```bash
# Backend Automated Tests (Including 100,000+ Corner Cases)
cd backend
npm run test

# Frontend Automated Tests
cd frontend
npm run test
```

---

## Deliverables Documentation

- [ARCHITECTURE.md](file:///c:/Codity/docs/ARCHITECTURE.md) - System Architecture & Topology
- [ER_DIAGRAM.md](file:///c:/Codity/docs/ER_DIAGRAM.md) - Database Schema & ER Diagram
- [API_DOCUMENTATION.md](file:///c:/Codity/docs/API_DOCUMENTATION.md) - REST API Spec
- [DESIGN_DECISIONS.md](file:///c:/Codity/docs/DESIGN_DECISIONS.md) - Major Trade-Offs & Technical Rationale

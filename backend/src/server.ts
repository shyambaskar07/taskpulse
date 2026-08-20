import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import { initDatabase } from './db/database';
import { wsManager } from './services/websocketService';
import { cronScheduler } from './services/cronSchedulerService';
import { WorkerEngine } from './services/workerEngineService';
import { authRouter } from './routes/authRoutes';
import { queueRouter } from './routes/queueRoutes';
import { jobRouter } from './routes/jobRoutes';
import { workerRouter } from './routes/workerRoutes';
import { dlqRouter } from './routes/dlqRoutes';
import { metricsRouter } from './routes/metricsRoutes';
import { prometheusRouter } from './routes/prometheusRoutes';
import { chaosRouter } from './routes/chaosRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Initialize Database & Seed Defaults
initDatabase();

// Setup HTTP Server & WebSockets
const server = http.createServer(app);
wsManager.init(server);

// Start Cron Scheduler & Stranded Job Recovery Service
cronScheduler.start();

// Start In-Process Default Worker Instance (Concurrency 5)
const embeddedWorker = new WorkerEngine(5);
embeddedWorker.start();

// API Route Mounts
app.use('/api/auth', authRouter);
app.use('/api/queues', queueRouter);
app.use('/api/jobs', jobRouter);
app.use('/api/jobs/chaos', chaosRouter);
app.use('/api/workers', workerRouter);
app.use('/api/dlq', dlqRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/metrics/prometheus', prometheusRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', system: 'TaskPulse Distributed Job Scheduler', timestamp: new Date().toISOString() });
});

// Start Server
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`TaskPulse Distributed Job Scheduler running on port ${PORT}`);
  console.log(`WebSocket server listening at ws://localhost:${PORT}/ws`);
  console.log(`Prometheus TSDB metrics at http://localhost:${PORT}/api/metrics/prometheus`);
  console.log(`=======================================================`);
});

// Graceful Shutdown
process.on('SIGINT', async () => {
  console.log('\n[TaskPulse] Shutting down gracefully...');
  cronScheduler.stop();
  await embeddedWorker.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[TaskPulse] Shutting down gracefully...');
  cronScheduler.stop();
  await embeddedWorker.shutdown();
  process.exit(0);
});

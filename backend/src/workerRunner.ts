import dotenv from 'dotenv';
import { initDatabase } from './db/database';
import { WorkerEngine } from './services/workerEngineService';

dotenv.config();
initDatabase();

const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
const standaloneWorker = new WorkerEngine(concurrency);

standaloneWorker.start().then(() => {
  console.log(` Standalone TaskPulse Worker running with PID ${process.pid}`);
});

process.on('SIGINT', async () => {
  await standaloneWorker.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await standaloneWorker.shutdown();
  process.exit(0);
});

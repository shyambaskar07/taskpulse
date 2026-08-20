import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const connectionString = 
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRESQL_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  `postgres://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'postgres'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'taskpulse'}`;

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function query(text: string, params?: any[]) {
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (err: any) {
    console.error('Database Query Error:', err.message);
    return { rows: [], rowCount: 0 };
  }
}

export async function queryRows(text: string, params?: any[]): Promise<any[]> {
  try {
    const res = await pool.query(text, params);
    return res.rows;
  } catch (err: any) {
    console.error('Database QueryRows Error:', err.message);
    return [];
  }
}

export async function queryOne(text: string, params?: any[]): Promise<any | null> {
  try {
    const res = await pool.query(text, params);
    return res.rows.length > 0 ? res.rows[0] : null;
  } catch (err: any) {
    console.error('Database QueryOne Error:', err.message);
    return null;
  }
}

export async function getClient(): Promise<PoolClient | null> {
  try {
    return await pool.connect();
  } catch (err: any) {
    console.error('Failed to get Database client:', err.message);
    return null;
  }
}

export async function initDatabase() {
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'OPERATOR',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS organizations (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(64) PRIMARY KEY,
        org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        api_key VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS retry_policies (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        strategy VARCHAR(32) NOT NULL,
        max_retries INTEGER NOT NULL DEFAULT 3,
        base_delay_ms INTEGER NOT NULL DEFAULT 1000,
        max_delay_ms INTEGER NOT NULL DEFAULT 60000,
        jitter INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS queues (
        id VARCHAR(64) PRIMARY KEY,
        project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        priority INTEGER NOT NULL DEFAULT 5,
        max_concurrency INTEGER NOT NULL DEFAULT 10,
        retry_policy_id VARCHAR(64) REFERENCES retry_policies(id) ON DELETE SET NULL,
        is_paused INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, name)
      );

      CREATE TABLE IF NOT EXISTS jobs (
        id VARCHAR(64) PRIMARY KEY,
        queue_id VARCHAR(64) NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
        parent_job_id VARCHAR(64) REFERENCES jobs(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(64) NOT NULL DEFAULT 'CALCULATION',
        payload TEXT NOT NULL DEFAULT '{}',
        status VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
        priority INTEGER NOT NULL DEFAULT 5,
        run_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        retry_strategy VARCHAR(32) NOT NULL DEFAULT 'EXPONENTIAL',
        base_delay_ms INTEGER NOT NULL DEFAULT 1000,
        max_delay_ms INTEGER NOT NULL DEFAULT 60000,
        timeout_ms INTEGER NOT NULL DEFAULT 30000,
        rate_limit_key VARCHAR(255),
        claimed_by_worker_id VARCHAR(64),
        claimed_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        failed_at TIMESTAMP WITH TIME ZONE,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_claim ON jobs(queue_id, status, run_at, priority DESC, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

      CREATE TABLE IF NOT EXISTS job_dependencies (
        id VARCHAR(64) PRIMARY KEY,
        parent_job_id VARCHAR(64) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        child_job_id VARCHAR(64) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        status VARCHAR(32) NOT NULL DEFAULT 'WAITING',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(parent_job_id, child_job_id)
      );

      CREATE TABLE IF NOT EXISTS scheduled_jobs (
        id VARCHAR(64) PRIMARY KEY,
        queue_id VARCHAR(64) NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        cron_expression VARCHAR(64) NOT NULL,
        payload TEXT NOT NULL DEFAULT '{}',
        job_type VARCHAR(64) NOT NULL DEFAULT 'CALCULATION',
        retry_policy_id VARCHAR(64),
        is_active INTEGER NOT NULL DEFAULT 1,
        last_run_at TIMESTAMP WITH TIME ZONE,
        next_run_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS job_executions (
        id VARCHAR(64) PRIMARY KEY,
        job_id VARCHAR(64) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        worker_id VARCHAR(64) NOT NULL,
        attempt_number INTEGER NOT NULL,
        status VARCHAR(32) NOT NULL,
        error_message TEXT,
        started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        finished_at TIMESTAMP WITH TIME ZONE,
        duration_ms INTEGER
      );

      CREATE TABLE IF NOT EXISTS job_logs (
        id VARCHAR(64) PRIMARY KEY,
        execution_id VARCHAR(64),
        job_id VARCHAR(64) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        level VARCHAR(32) NOT NULL DEFAULT 'INFO',
        message TEXT NOT NULL,
        metadata TEXT DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS dead_letter_queue (
        id VARCHAR(64) PRIMARY KEY,
        job_id VARCHAR(64) UNIQUE NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        queue_id VARCHAR(64) NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
        failed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        final_error TEXT NOT NULL,
        total_attempts INTEGER NOT NULL,
        ai_failure_summary TEXT,
        status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
      );

      CREATE TABLE IF NOT EXISTS workers (
        id VARCHAR(64) PRIMARY KEY,
        hostname VARCHAR(255) NOT NULL,
        pid INTEGER NOT NULL,
        concurrency_limit INTEGER NOT NULL DEFAULT 5,
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS worker_heartbeats (
        id VARCHAR(64) PRIMARY KEY,
        worker_id VARCHAR(64) NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        cpu_percent REAL NOT NULL DEFAULT 0.0,
        memory_mb REAL NOT NULL DEFAULT 0.0,
        active_jobs_count INTEGER NOT NULL DEFAULT 0
      );
    `);

    await client.query('COMMIT');
    await seedDefaultData(client);
    console.log('[TaskPulse DB] Database connection & schema initialized successfully.');
  } catch (err: any) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch {}
    }
    console.warn('[TaskPulse DB] Warning: PostgreSQL not reachable yet. Server staying online. Error:', err.message);
  } finally {
    if (client) client.release();
  }
}

async function seedDefaultData(client: PoolClient) {
  try {
    const userRes = await client.query(`SELECT count(*) as cnt FROM users`);
    if (parseInt(userRes.rows[0].cnt, 10) === 0) {
      const adminId = 'usr_admin_default';
      const passHash = bcrypt.hashSync('admin123', 10);
      await client.query(`INSERT INTO users (id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5)`, [
        adminId, 'admin@taskpulse.io', passHash, 'System Administrator', 'ADMIN'
      ]);

      const orgId = 'org_default';
      await client.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [orgId, 'TaskPulse Core Org']);

      const projectId = 'proj_default';
      const apiKey = 'tp_live_secret_key_8899aabbcc';
      await client.query(`INSERT INTO projects (id, org_id, name, api_key) VALUES ($1, $2, $3, $4)`, [
        projectId, orgId, 'Production Pipeline', apiKey
      ]);

      const retryPolicyId = 'rp_exponential_default';
      await client.query(`INSERT INTO retry_policies (id, name, strategy, max_retries, base_delay_ms, max_delay_ms, jitter) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
        retryPolicyId, 'Exponential Standard', 'EXPONENTIAL', 3, 1000, 30000, 1
      ]);

      const defaultQueues = [
        { id: 'q_high_priority', name: 'critical-notifications', priority: 10, max_concurrency: 20 },
        { id: 'q_default', name: 'default-processing', priority: 5, max_concurrency: 10 },
        { id: 'q_background', name: 'data-sync-reports', priority: 2, max_concurrency: 5 }
      ];

      for (const q of defaultQueues) {
        await client.query(`INSERT INTO queues (id, project_id, name, priority, max_concurrency, retry_policy_id) VALUES ($1, $2, $3, $4, $5, $6)`, [
          q.id, projectId, q.name, q.priority, q.max_concurrency, retryPolicyId
        ]);
      }
    }
  } catch (err: any) {
    console.warn('[TaskPulse DB] Seed warning:', err.message);
  }
}

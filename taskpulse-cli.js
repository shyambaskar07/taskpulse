#!/usr/bin/env node
const http = require('http');

const API_BASE = process.env.API_URL || 'http://localhost:4000/api';

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  console.log(`=======================================================`);
  console.log(`TaskPulse Distributed Scheduler Command Line Tool (CLI)`);
  console.log(`=======================================================\n`);

  try {
    if (command === 'status' || command === 'metrics') {
      const res = await request('/metrics');
      console.log(`System Status Summary:`);
      console.log(`• Total Jobs:      ${JSON.stringify(res.jobs)}`);
      console.log(`• Active Workers:  ${res.workers?.active} / ${res.workers?.total} Nodes`);
      console.log(`• Total Capacity:  ${res.workers?.capacity} Concurrent Slots`);
      console.log(`• Avg Latency:     ${res.performance?.avgDurationMs} ms`);
    } else if (command === 'queues') {
      const res = await request('/queues');
      console.log(`Registered Queues:`);
      console.table(res.queues.map((q) => ({
        ID: q.id,
        Name: q.name,
        Priority: q.priority,
        MaxConc: q.max_concurrency,
        Queued: q.queued_count,
        Active: q.active_count,
        Completed: q.completed_count
      })));
    } else if (command === 'jobs') {
      const res = await request('/jobs?limit=10');
      console.log(`Recent Jobs:`);
      console.table(res.jobs.map((j) => ({
        ID: j.id,
        Name: j.name,
        Queue: j.queue_name,
        Status: j.status,
        Attempts: `${j.attempts}/${j.max_retries}`,
        RunAt: new Date(j.run_at).toLocaleTimeString()
      })));
    } else if (command === 'chaos') {
      console.log(`Dispatching Chaos Engineering Test Suite...`);
      const res = await request('/jobs/chaos', 'POST');
      console.log(`Result: ${res.message}`);
    } else if (command === 'enqueue') {
      const name = args[1] || 'CLI Dispatched Job';
      const res = await request('/jobs', 'POST', {
        queueId: 'q_default',
        name: name,
        type: 'CALCULATION',
        payload: { source: 'CLI' }
      });
      console.log(`Job Enqueued Successfully! ID: ${res.id}`);
    } else {
      console.log(`Available Commands:`);
      console.log(`  node taskpulse-cli.js status   - View system metrics & worker pool capacity`);
      console.log(`  node taskpulse-cli.js queues   - List queues, priorities, and concurrency limits`);
      console.log(`  node taskpulse-cli.js jobs     - List recent jobs`);
      console.log(`  node taskpulse-cli.js enqueue  - Enqueue a new job from the command line`);
      console.log(`  node taskpulse-cli.js chaos    - Trigger Chaos fault-injection test suite`);
    }
  } catch (err) {
    console.error(`CLI Error: Unable to connect to TaskPulse server at ${API_BASE}. Make sure 'npm run dev' is running in backend.`);
  }
}

main();

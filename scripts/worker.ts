import { runDueAttempts } from '../lib/recovery/worker';

const secret = process.env.WORKER_SECRET;
if (!secret) {
  console.error('WORKER_SECRET is required to run the worker loop.');
  process.exit(1);
}

async function tick() {
  const result = await runDueAttempts(new Date());
  console.info(JSON.stringify({ level: 'info', msg: 'worker_tick', ...result }));
}

tick();
setInterval(tick, 5_000);

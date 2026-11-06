export async function register() {
  if (process.env.RECOVERY_WORKER_ENABLED !== 'true') {
    return;
  }

  const secret = process.env.WORKER_SECRET;
  if (!secret) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        msg: 'RECOVERY_WORKER_ENABLED without WORKER_SECRET; worker not started',
      })
    );
    return;
  }

  const port = process.env.PORT ?? '3000';
  const baseUrl =
    process.env.INTERNAL_WORKER_BASE_URL ?? `http://127.0.0.1:${port}`;

  setInterval(() => {
    fetch(`${baseUrl}/api/internal/worker/tick`, {
      method: 'POST',
      headers: {
        'x-worker-secret': secret,
        'Content-Type': 'application/json',
      },
      body: '{}',
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({ level: 'error', msg: 'worker_tick_failed', error: message })
      );
    });
  }, 5_000);

  console.info(JSON.stringify({ level: 'info', msg: 'recovery_worker_started' }));
}

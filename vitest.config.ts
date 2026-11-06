import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globalSetup: ['./tests/global-setup.ts'],
    fileParallelism: false,
    env: {
      DATABASE_URL: 'file:./test.db',
      RAZORPAY_USE_FAKE: 'true',
      RAZORPAY_KEY_SECRET: 'test_secret',
      RAZORPAY_WEBHOOK_SECRET: 'whsec_test_fake',
      WORKER_SECRET: 'test_worker_secret',
      AUTH_SECRET: 'test-auth-secret',
      NEXTAUTH_URL: 'http://localhost:3000',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
});

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const testDbPath = path.join(process.cwd(), 'prisma', 'test.db');

export default function globalSetup() {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  const env = {
    ...process.env,
    DATABASE_URL: 'file:./test.db',
    AUTH_SECRET: 'test-auth-secret',
    NEXTAUTH_URL: 'http://localhost:3000',
    SEED_ADMIN_EMAIL: 'owner@test.local',
    SEED_ADMIN_PASSWORD: 'testpass123',
    SEED_VIEWER_EMAIL: 'viewer@test.local',
    SEED_VIEWER_PASSWORD: 'testpass123',
  };

  execSync('npx prisma generate', {
    cwd: process.cwd(),
    env,
    stdio: 'pipe',
  });
  execSync('npx prisma migrate deploy', {
    cwd: process.cwd(),
    env,
    stdio: 'pipe',
  });
  execSync('npx prisma db seed', {
    cwd: process.cwd(),
    env,
    stdio: 'pipe',
  });
}

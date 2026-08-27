import { NextResponse } from 'next/server';
import { simulationService } from '@/lib/engines/simulation-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  simulationService.tick();

  return NextResponse.json(simulationService.getState(), {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

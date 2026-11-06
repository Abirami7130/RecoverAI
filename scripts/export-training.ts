import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/db';

async function main() {
  const rows = await prisma.trainingExample.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const outDir = path.join(process.cwd(), 'data', 'training');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'examples.jsonl');

  const lines = rows.map((row) =>
    JSON.stringify({
      caseId: row.caseId,
      attemptId: row.attemptId,
      featureJson: row.featureJson,
      action: row.action,
      verifiedSuccess: row.verifiedSuccess,
      createdAt: row.createdAt.toISOString(),
    })
  );

  fs.writeFileSync(outPath, lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');
  console.log(`Wrote ${rows.length} training example(s) to ${outPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

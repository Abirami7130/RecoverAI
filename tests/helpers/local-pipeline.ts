import { spawn } from 'child_process';
import path from 'path';
import type {
  FastApiPredictResponse,
  PredictTransactionInput,
} from '@/lib/recovery/python-client';

const PIPELINE_SCRIPT = `
import json, os, sys, warnings
warnings.filterwarnings("ignore")
root = os.environ["RECOVERAI_ROOT"]
sys.path.insert(0, os.path.join(root, "ml", "src"))
from recoverai_pipeline import run_recoverai_pipeline
payload = json.load(sys.stdin)
context = payload.pop("context", None)
policy = payload.pop("policy", None)
json.dump(run_recoverai_pipeline(payload, context=context, policy=policy), sys.stdout)
`;

/** Runs the same Python pipeline FastAPI serves. Does not call a payment provider. */
export function predictWithRecoveraiPipeline(
  input: PredictTransactionInput
): Promise<FastApiPredictResponse> {
  const python = path.join(process.cwd(), 'ml/.venv/bin/python');
  return new Promise((resolve, reject) => {
    const child = spawn(python, ['-c', PIPELINE_SCRIPT], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PYTHONWARNINGS: 'ignore',
        RECOVERAI_ROOT: process.cwd(),
      },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `pipeline exited ${code}`));
        return;
      }
      resolve(JSON.parse(stdout) as FastApiPredictResponse);
    });
    child.stdin.write(JSON.stringify(input));
    child.stdin.end();
  });
}

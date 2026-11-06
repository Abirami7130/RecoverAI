import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULE_GLOSSARY } from '@/lib/recovery/rule-glossary';

describe('rule glossary', () => {
  it('covers every id in the Python fixture export', () => {
    const fixturePath = join(
      process.cwd(),
      'tests/fixtures/python-rule-ids.json'
    );
    const ids = JSON.parse(readFileSync(fixturePath, 'utf8')) as string[];
    for (const id of ids) {
      expect(RULE_GLOSSARY[id], `missing glossary entry for ${id}`).toBeTruthy();
    }
  });
});

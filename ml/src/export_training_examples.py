#!/usr/bin/env python3
"""
Reads training rows exported by `npm run export:training` (JSONL).
Does not connect to Next.js or Prisma.
"""

from __future__ import annotations

import argparse
import json
import os
import sys


def load_examples(path: str) -> list[dict]:
    rows: list[dict] = []
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            text = line.strip()
            if not text:
                continue
            rows.append(json.loads(text))
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect exported training examples JSONL")
    parser.add_argument(
        "--path",
        default=os.path.join("data", "training", "examples.jsonl"),
        help="Path to examples.jsonl written by npm run export:training",
    )
    args = parser.parse_args()

    if not os.path.isfile(args.path):
        print(f"No export file at {args.path}. Run npm run export:training first.", file=sys.stderr)
        return 1

    rows = load_examples(args.path)
    successes = sum(1 for row in rows if row.get("verifiedSuccess"))
    print(f"examples: {len(rows)}")
    print(f"verified_success: {successes}")
    print(f"verified_failure: {len(rows) - successes}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

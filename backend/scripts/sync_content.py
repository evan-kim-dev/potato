#!/usr/bin/env python3
"""Validate canonical backend/data/*.json for the Next.js app (web/).

SSOT is JSON under backend/data/. The web app reads these files directly —
there is no frontend/data.js anymore.

Usage:
  python backend/scripts/sync_content.py check
  python backend/scripts/sync_content.py generate   # alias of check (compat)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_ROOT / "data"

REQUIRED = (
    "spots.json",
    "catalog.json",
)

OPTIONAL = (
    "tour_kor_festivals.json",
    "forecast_msg.json",
    "kto_aggregated_spots.json",
    "tour_region_photos.json",
    "gangwon_sigungu_codes.json",
)


def load_json(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def check() -> int:
    errors: list[str] = []

    for name in REQUIRED:
        path = DATA_DIR / name
        if not path.exists():
            errors.append(f"missing required {name}")
            continue
        try:
            data = load_json(path)
        except json.JSONDecodeError as e:
            errors.append(f"{name}: invalid JSON ({e})")
            continue

        if name == "spots.json":
            if not isinstance(data, list) or not data:
                errors.append("spots.json must be a non-empty array")
            else:
                sample = data[0]
                for key in ("name", "region"):
                    if key not in sample:
                        errors.append(f"spots.json items need '{key}'")
                        break
        elif name == "catalog.json":
            if not isinstance(data, dict) or "cities" not in data:
                errors.append("catalog.json needs a 'cities' array")

    for name in OPTIONAL:
        path = DATA_DIR / name
        if not path.exists():
            print(f"optional missing: {name}")
            continue
        try:
            load_json(path)
        except json.JSONDecodeError as e:
            errors.append(f"{name}: invalid JSON ({e})")

    if errors:
        for e in errors:
            print(e, file=sys.stderr)
        return 1

    print(f"OK - SSOT under {DATA_DIR} ({len(REQUIRED)} required files)")
    return 0


def main() -> int:
    args = sys.argv[1:]
    cmd = args[0] if args else "check"
    if cmd in ("check", "--check", "generate"):
        # generate kept as alias so older scripts/docs keep working
        return check()
    print("Usage: check | generate", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())

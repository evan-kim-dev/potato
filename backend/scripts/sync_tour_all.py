#!/usr/bin/env python3
"""TourAPI 전체 동기화 — ldong → 병렬 fetch → 기상 → SSOT 검증."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run(script: str, *args: str) -> int:
    cmd = [sys.executable, str(ROOT / "scripts" / script), *args]
    print(">", " ".join(cmd))
    return subprocess.call(cmd, cwd=str(ROOT))


def main() -> int:
    if run("sync_tour_ldong.py") != 0:
        print(
            "Warning: ldong/eco code sync skipped; using committed gangwon_sigungu_codes.json",
            file=sys.stderr,
        )

    if run("sync_tour_parallel_fetch.py") != 0:
        print("Warning: some KTO APIs failed; continuing with partial data.", file=sys.stderr)

    if run("sync_beach_weather.py") != 0:
        print("Warning: beach weather sync failed; continuing.", file=sys.stderr)

    if run("sync_forecast_msg.py") != 0:
        print("Warning: fcst msg sync failed; continuing.", file=sys.stderr)

    return run("sync_content.py", "check")


if __name__ == "__main__":
    raise SystemExit(main())

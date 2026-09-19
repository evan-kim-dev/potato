#!/usr/bin/env python3
"""TourAPI 전체 동기화 — ldong 선행 후 6 API 병렬 fetch + frontend/data.js 생성."""

from __future__ import annotations

import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run(script: str, *args: str) -> int:
    cmd = [sys.executable, str(ROOT / "scripts" / script), *args]
    print(">", " ".join(cmd))
    return subprocess.call(cmd, cwd=str(ROOT))


def main() -> int:
    # Kor/Eco 시군구 코드는 선행 권장 — 실패해도 커밋된 codes.json으로 배포 계속
    if run("sync_tour_ldong.py") != 0:
        print(
            "Warning: ldong/eco code sync skipped; using committed gangwon_sigungu_codes.json",
            file=sys.stderr,
        )

    # 6 KTO API 병렬 fetch → JSON + aggregation
    if run("sync_tour_parallel_fetch.py") != 0:
        print("Warning: some KTO APIs failed; continuing with partial data.", file=sys.stderr)

    # 기상청 해수욕장 날씨 (키 없으면 stub 유지)
    if run("sync_beach_weather.py") != 0:
        print("Warning: beach weather sync failed; continuing.", file=sys.stderr)

    return run("sync_content.py", "generate")


if __name__ == "__main__":
    raise SystemExit(main())

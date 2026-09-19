#!/usr/bin/env python3
"""Sync 기상청 BeachInfoservice → backend/data/tour_beach_weather.json."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from beach_weather_api import (  # noqa: E402
    BeachApiError,
    OUT_PATH,
    load_featured_beaches,
    sync_gangwon_beach_weather,
)


def write_stub(reason: str) -> dict:
    beaches = load_featured_beaches()
    payload = {
        "updated_at": None,
        "api": "https://apis.data.go.kr/1360000/BeachInfoservice",
        "ops": [
            "getUltraSrtFcstBeach",
            "getVilageFcstBeach",
            "getTideInfoBeach",
            "getSunInfoBeach",
        ],
        "count": len(beaches),
        "ok": 0,
        "stub": True,
        "reason": reason,
        "errors": [],
        "beaches": [{**b, "weather": None} for b in beaches],
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload


def main() -> int:
    try:
        payload = sync_gangwon_beach_weather()
    except BeachApiError as e:
        print(f"Warning: beach weather sync skipped — {e}", file=sys.stderr)
        payload = write_stub(str(e))
        print(f"Wrote stub {OUT_PATH}")
        return 0

    print(
        f"Wrote {OUT_PATH} ok={payload.get('ok')}/{payload.get('count')} "
        f"errors={len(payload.get('errors') or [])}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

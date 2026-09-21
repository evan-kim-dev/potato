#!/usr/bin/env python3
"""Sync 기상청 단기예보 통보문 → backend/data/forecast_msg.json."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from forecast_msg_api import (  # noqa: E402
    FcstMsgError,
    OUT_PATH,
    sync_gangwon_fcst_msg,
    write_stub,
)


def main() -> int:
    try:
        payload = sync_gangwon_fcst_msg()
    except FcstMsgError as e:
        print(f"Warning: fcst msg sync skipped — {e}", file=sys.stderr)
        payload = write_stub(str(e))
        print(f"Wrote stub {OUT_PATH}")
        return 0

    print(
        f"Wrote {OUT_PATH} ok={payload.get('ok')} "
        f"errors={len(payload.get('errors') or [])}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

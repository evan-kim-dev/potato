#!/usr/bin/env python3
"""Sync 한국조폐공사 지역사랑상품권 결제정보 → backend/data/komsco_payments.json.

환경변수: KOMSCO_PAYMENT_KEY 또는 DATA_GO_KR_SERVICE_KEY
(공공데이터포털 일반 인증키 — Encoding/Decoding 둘 다 시도)

API: GET https://apis.data.go.kr/B190001/localGiftsPaymentV3/paymentsV3
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "komsco_payments.json"
ENDPOINT = "https://apis.data.go.kr/B190001/localGiftsPaymentV3/paymentsV3"

# 법정동 앞 5자리 (강원특별자치도 51xxx)
GANGWON = {
    "춘천시": "51110",
    "원주시": "51130",
    "강릉시": "51150",
    "동해시": "51170",
    "태백시": "51190",
    "속초시": "51210",
    "삼척시": "51230",
    "홍천군": "51720",
    "횡성군": "51730",
    "영월군": "51750",
    "평창군": "51760",
    "정선군": "51770",
    "철원군": "51780",
    "화천군": "51790",
    "양구군": "51800",
    "인제군": "51810",
    "고성군": "51820",
    "양양군": "51830",
}

QUIET = {
    "정선군",
    "태백시",
    "영월군",
    "삼척시",
    "평창군",
    "횡성군",
    "화천군",
    "양구군",
    "인제군",
    "고성군",
    "철원군",
}


def _key() -> str:
    return (
        os.environ.get("DATA_GO_KR_SERVICE_KEY")
        or os.environ.get("TOUR_API_SERVICE_KEY")
        or os.environ.get("KOMSCO_PAYMENT_KEY")
        or ""
    ).strip()


def _ym_ago(n: int) -> str:
    y, m = date.today().year, date.today().month
    m -= n
    while m <= 0:
        m += 12
        y -= 1
    return f"{y}{m:02d}"


def _fetch(key: str, code: str, ym_from: str, ym_to: str) -> list[dict]:
    # Decoding 키를 그대로 쓰고, 이미 인코딩된 키면 quote 생략에 가깝게
    params = {
        "serviceKey": key,
        "page": "1",
        "perPage": "1000",
        "returnType": "JSON",
        "cond[crtr_ym::GTE]": ym_from,
        "cond[crtr_ym::LTE]": ym_to,
        "cond[usage_rgn_cd::EQ]": code,
    }
    # serviceKey는 포털 Encoding 키면 이중 인코딩 금지
    q = urllib.parse.urlencode(params, safe="%")
    url = f"{ENDPOINT}?{q}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = resp.read().decode("utf-8", errors="replace")
    data = json.loads(body)
    if isinstance(data, dict) and isinstance(data.get("data"), list):
        return data["data"]
    if isinstance(data, list):
        return data
    return []


def main() -> int:
    key = _key()
    ym_from, ym_to = _ym_ago(3), _ym_ago(1)
    if not key:
        stub = {
            "updated_at": date.today().isoformat(),
            "source": "한국조폐공사_지역사랑상품권_결제정보 paymentsV3",
            "period": {"from": ym_from, "to": ym_to},
            "ok": False,
            "note": "DATA_GO_KR_SERVICE_KEY(또는 TOUR_API_SERVICE_KEY) 없음",
            "regions": [],
            "totalAmount": 0,
            "totalCount": 0,
            "quietAmount": 0,
            "quietSharePct": 0,
        }
        OUT.write_text(json.dumps(stub, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Wrote stub {OUT} (no key)", file=sys.stderr)
        return 0

    by_code: dict[str, dict[str, int]] = {}
    errors: list[str] = []
    for region, code in GANGWON.items():
        try:
            rows = _fetch(key, code, ym_from, ym_to)
        except urllib.error.HTTPError as e:
            errors.append(f"{region}: HTTP {e.code}")
            continue
        except Exception as e:  # noqa: BLE001
            errors.append(f"{region}: {e}")
            continue
        bucket = by_code.setdefault(code, {"amount": 0, "count": 0})
        for r in rows:
            bucket["amount"] += int(r.get("stlm_amt") or 0)
            bucket["count"] += int(r.get("stlm_nocs") or 0)

    code_to_region = {v: k for k, v in GANGWON.items()}
    regions = []
    for code, v in by_code.items():
        region = code_to_region[code]
        regions.append(
            {
                "region": region,
                "code": code,
                "amount": v["amount"],
                "count": v["count"],
                "quiet": region in QUIET,
            }
        )
    regions.sort(key=lambda x: x["amount"], reverse=True)
    total_amount = sum(r["amount"] for r in regions)
    total_count = sum(r["count"] for r in regions)
    quiet_amount = sum(r["amount"] for r in regions if r["quiet"])

    payload = {
        "updated_at": date.today().isoformat(),
        "source": "한국조폐공사_지역사랑상품권_결제정보 paymentsV3",
        "period": {"from": ym_from, "to": ym_to},
        "ok": bool(regions) and not errors,
        "note": "; ".join(errors) if errors else None,
        "regions": regions,
        "totalAmount": total_amount,
        "totalCount": total_count,
        "quietAmount": quiet_amount,
        "quietSharePct": round(quiet_amount / total_amount * 100) if total_amount else 0,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"Wrote {OUT} regions={len(regions)} amount={total_amount} "
        f"errors={len(errors)}"
    )
    return 0 if regions else 1


if __name__ == "__main__":
    raise SystemExit(main())

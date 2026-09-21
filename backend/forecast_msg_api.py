"""기상청_단기예보 통보문 조회서비스 (VilageFcstMsgService).

Portal: https://www.data.go.kr/data/15058629/openapi.do
Base:   https://apis.data.go.kr/1360000/VilageFcstMsgService
License: 공공누리 제1유형(출처표시) — UI에 기상청 저작자 표시 필수

Ops:
  getWthrSituation — 기상개황
  getLandFcst      — 육상예보
  getSeaFcst       — 해상예보
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

KST = timezone(timedelta(hours=9))
API_BASE = "https://apis.data.go.kr/1360000/VilageFcstMsgService"
DATA_DIR = Path(__file__).resolve().parent / "data"
OUT_PATH = DATA_DIR / "forecast_msg.json"

# 공공누리 제1유형 출처표시
ATTRIBUTION = {
    "license": "공공누리 제1유형(출처표시)",
    "author": "기상청",
    "source_name": "기상청_단기예보 통보문 조회서비스",
    "source_url": "https://www.data.go.kr/data/15058629/openapi.do",
    "notice": (
        "본 저작물은 공공누리 제1유형에 따라 기상청에서 공공누리로 개방한 "
        "「단기예보 통보문」을 이용하였으며, 출처는 기상청입니다."
    ),
}

# 강원 발표관서·예보구역
GANGWON_TARGETS = {
    "situation": [
        {"stnId": "105", "label": "강원영동(강릉)"},
        {"stnId": "101", "label": "강원영서(춘천)"},
    ],
    "land": [
        {"regId": "11D20000", "label": "강원영동"},
        {"regId": "11D10000", "label": "강원영서"},
    ],
    "sea": [
        {"regId": "12C20000", "label": "동해중부해상"},
    ],
}


class FcstMsgError(RuntimeError):
    pass


def get_service_key() -> str:
    key = (
        os.getenv("KMA_FCST_MSG_SERVICE_KEY")
        or os.getenv("KMA_BEACH_SERVICE_KEY")
        or os.getenv("TOUR_API_SERVICE_KEY")
        or os.getenv("DATA_GO_KR_SERVICE_KEY")
        or ""
    ).strip()
    if not key:
        raise FcstMsgError(
            "KMA_FCST_MSG_SERVICE_KEY(또는 TOUR_API_SERVICE_KEY)가 없습니다. "
            "공공데이터포털에서 '기상청_단기예보 통보문 조회서비스' 활용신청 후 키를 설정하세요."
        )
    return key


def _now_kst() -> datetime:
    return datetime.now(KST)


def _call(op: str, params: dict[str, Any], *, service_key: str | None = None) -> dict[str, Any]:
    key = service_key or get_service_key()
    q = urllib.parse.urlencode(
        {
            "serviceKey": key,
            "dataType": "JSON",
            "numOfRows": params.pop("numOfRows", 20),
            "pageNo": params.pop("pageNo", 1),
            **params,
        },
        safe="%",
    )
    url = f"{API_BASE}/{op}?{q}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            raw = resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace") if e.fp else ""
        raise FcstMsgError(f"{op} HTTP {e.code}: {body[:200]}") from e
    except urllib.error.URLError as e:
        raise FcstMsgError(f"{op} network: {e}") from e

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as e:
        raise FcstMsgError(f"{op} invalid JSON: {raw[:120]}") from e

    if "OpenAPI_ServiceResponse" in payload:
        hdr = (payload.get("OpenAPI_ServiceResponse") or {}).get("cmmMsgHeader") or {}
        raise FcstMsgError(f"{op} gateway: {hdr.get('errMsg') or hdr.get('returnAuthMsg') or hdr}")

    header = (payload.get("response") or {}).get("header") or {}
    code = str(header.get("resultCode", ""))
    if code and code not in ("00", "0000"):
        raise FcstMsgError(f"{op} {code}: {header.get('resultMsg')}")
    return payload


def _items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    body = (payload.get("response") or {}).get("body") or {}
    items = body.get("items") or {}
    raw = items.get("item")
    if raw is None:
        return []
    if isinstance(raw, dict):
        return [raw]
    return list(raw)


def _fmt_tm(tm: Any) -> str:
    s = str(tm or "").strip()
    if len(s) >= 12 and s.isdigit():
        return f"{s[0:4]}-{s[4:6]}-{s[6:8]} {s[8:10]}:{s[10:12]}"
    if len(s) >= 10 and s.isdigit():
        return f"{s[0:4]}-{s[4:6]}-{s[6:8]} {s[8:10]}:00"
    return s


def _clean_text(v: Any) -> str:
    if v is None:
        return ""
    text = str(v).strip()
    if text in ("", "null", "None", "-"):
        return ""
    return text.replace("\\n", "\n")


def fetch_situation(stn_id: str, *, service_key: str | None = None) -> dict[str, Any]:
    items = _items(_call("getWthrSituation", {"stnId": stn_id}, service_key=service_key))
    if not items:
        return {"stnId": stn_id, "empty": True}
    it = items[0]
    return {
        "stnId": str(it.get("stnId") or stn_id),
        "tmFc": _fmt_tm(it.get("tmFc")),
        "overview": _clean_text(it.get("wfSv1")),
        "warning": _clean_text(it.get("wn")),
        "pre_warning": _clean_text(it.get("wr")),
    }


def fetch_land(reg_id: str, *, service_key: str | None = None) -> dict[str, Any]:
    items = _items(_call("getLandFcst", {"regId": reg_id}, service_key=service_key))
    periods = []
    for it in items:
        periods.append(
            {
                "numEf": it.get("numEf"),
                "announceTime": _fmt_tm(it.get("announceTime") or it.get("tmFc")),
                "wf": _clean_text(it.get("wf")),
                "wfCd": _clean_text(it.get("wfCd")),
                "ta": _clean_text(it.get("ta")),
                "rnSt": _clean_text(it.get("rnSt")),
                "rnYn": _clean_text(it.get("rnYn")),
                "wd1": _clean_text(it.get("wd1")),
                "wd2": _clean_text(it.get("wd2")),
                "wsIt": _clean_text(it.get("wsIt")),
            }
        )
    return {
        "regId": reg_id,
        "announceTime": periods[0]["announceTime"] if periods else "",
        "periods": periods[:8],
    }


def fetch_sea(reg_id: str, *, service_key: str | None = None) -> dict[str, Any]:
    items = _items(_call("getSeaFcst", {"regId": reg_id}, service_key=service_key))
    periods = []
    for it in items:
        periods.append(
            {
                "numEf": it.get("numEf"),
                "announceTime": _fmt_tm(it.get("announceTime") or it.get("tmFc")),
                "wf": _clean_text(it.get("wf")),
                "wh": _clean_text(it.get("wh") or it.get("wav")),
                "wd1": _clean_text(it.get("wd1")),
                "wd2": _clean_text(it.get("wd2")),
                "wsIt": _clean_text(it.get("wsIt")),
            }
        )
    return {
        "regId": reg_id,
        "announceTime": periods[0]["announceTime"] if periods else "",
        "periods": periods[:8],
    }


def sync_gangwon_fcst_msg(*, service_key: str | None = None) -> dict[str, Any]:
    key = service_key or get_service_key()
    errors: list[dict[str, str]] = []
    situations = []
    for t in GANGWON_TARGETS["situation"]:
        try:
            situations.append({**t, "data": fetch_situation(t["stnId"], service_key=key)})
        except FcstMsgError as e:
            errors.append({"op": "getWthrSituation", "id": t["stnId"], "error": str(e)})
            situations.append({**t, "data": None})

    lands = []
    for t in GANGWON_TARGETS["land"]:
        try:
            lands.append({**t, "data": fetch_land(t["regId"], service_key=key)})
        except FcstMsgError as e:
            errors.append({"op": "getLandFcst", "id": t["regId"], "error": str(e)})
            lands.append({**t, "data": None})

    seas = []
    for t in GANGWON_TARGETS["sea"]:
        try:
            seas.append({**t, "data": fetch_sea(t["regId"], service_key=key)})
        except FcstMsgError as e:
            errors.append({"op": "getSeaFcst", "id": t["regId"], "error": str(e)})
            seas.append({**t, "data": None})

    payload = {
        "updated_at": _now_kst().isoformat(timespec="minutes"),
        "api": API_BASE,
        "ops": ["getWthrSituation", "getLandFcst", "getSeaFcst"],
        "attribution": ATTRIBUTION,
        "stub": False,
        "ok": sum(1 for x in situations + lands + seas if x.get("data")),
        "errors": errors,
        "situation": situations,
        "land": lands,
        "sea": seas,
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload


def write_stub(reason: str) -> dict[str, Any]:
    payload = {
        "updated_at": None,
        "api": API_BASE,
        "ops": ["getWthrSituation", "getLandFcst", "getSeaFcst"],
        "attribution": ATTRIBUTION,
        "stub": True,
        "reason": reason,
        "ok": 0,
        "errors": [],
        "situation": [{**t, "data": None} for t in GANGWON_TARGETS["situation"]],
        "land": [{**t, "data": None} for t in GANGWON_TARGETS["land"]],
        "sea": [{**t, "data": None} for t in GANGWON_TARGETS["sea"]],
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload

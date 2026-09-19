"""기상청 전국 해수욕장 날씨 조회서비스 (BeachInfoservice).

Portal: https://www.data.go.kr/data/15102239/openapi.do
Base:   https://apis.data.go.kr/1360000/BeachInfoservice

Confirmed ops:
  getUltraSrtFcstBeach — 초단기예보
  getVilageFcstBeach   — 단기예보
  getTideInfoBeach     — 조석
  getSunInfoBeach      — 일출·일몰
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
BEACH_API_BASE = "https://apis.data.go.kr/1360000/BeachInfoservice"
DATA_DIR = Path(__file__).resolve().parent / "data"
BEACHES_PATH = DATA_DIR / "gangwon_beaches.json"
OUT_PATH = DATA_DIR / "tour_beach_weather.json"

SKY_LABEL = {"1": "맑음", "3": "구름많음", "4": "흐림"}
PTY_LABEL = {
    "0": "",
    "1": "비",
    "2": "비/눈",
    "3": "눈",
    "4": "소나기",
    "5": "빗방울",
    "6": "빗방울눈날림",
    "7": "눈날림",
}


class BeachApiError(RuntimeError):
    pass


def get_beach_service_key() -> str:
    key = (
        os.getenv("KMA_BEACH_SERVICE_KEY")
        or os.getenv("TOUR_API_SERVICE_KEY")
        or os.getenv("DATA_GO_KR_SERVICE_KEY")
        or ""
    ).strip()
    if not key:
        raise BeachApiError(
            "KMA_BEACH_SERVICE_KEY(또는 TOUR_API_SERVICE_KEY)가 없습니다. "
            "공공데이터포털에서 '기상청_전국 해수욕장 날씨 조회서비스' 활용신청 후 키를 설정하세요."
        )
    return key


def load_featured_beaches() -> list[dict[str, Any]]:
    data = json.loads(BEACHES_PATH.read_text(encoding="utf-8"))
    return list(data.get("featured") or [])


def _now_kst() -> datetime:
    return datetime.now(KST)


def _base_date_time_ultra(now: datetime | None = None) -> tuple[str, str]:
    """초단기예보 base_time은 매시 30분 발표 → 40분 이후부터 조회."""
    now = now or _now_kst()
    t = now.replace(second=0, microsecond=0)
    if t.minute < 45:
        t = t - timedelta(hours=1)
    return t.strftime("%Y%m%d"), f"{t.hour:02d}30"


def _base_date_time_vilage(now: datetime | None = None) -> tuple[str, str]:
    """단기예보: 02/05/08/11/14/17/20/23시 발표."""
    now = now or _now_kst()
    slots = [2, 5, 8, 11, 14, 17, 20, 23]
    t = now.replace(second=0, microsecond=0)
    chosen = None
    for h in reversed(slots):
        cand = t.replace(hour=h, minute=10)
        if t >= cand:
            chosen = t.replace(hour=h, minute=0)
            break
    if chosen is None:
        chosen = (t - timedelta(days=1)).replace(hour=23, minute=0)
    return chosen.strftime("%Y%m%d"), f"{chosen.hour:02d}00"


def _call(op: str, params: dict[str, Any], *, service_key: str | None = None) -> dict[str, Any]:
    key = service_key or get_beach_service_key()
    q = urllib.parse.urlencode(
        {
            "serviceKey": key,
            "dataType": "JSON",
            "numOfRows": params.pop("numOfRows", 100),
            "pageNo": params.pop("pageNo", 1),
            **params,
        },
        safe="%",
    )
    # serviceKey may already be URL-encoded from portal; avoid double-encoding issues
    url = f"{BEACH_API_BASE}/{op}?{q}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            raw = resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace") if e.fp else ""
        raise BeachApiError(f"{op} HTTP {e.code}: {body[:200]}") from e
    except urllib.error.URLError as e:
        raise BeachApiError(f"{op} network: {e}") from e

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as e:
        raise BeachApiError(f"{op} invalid JSON: {raw[:120]}") from e

    # Gateway error envelope
    if "OpenAPI_ServiceResponse" in payload:
        hdr = (payload.get("OpenAPI_ServiceResponse") or {}).get("cmmMsgHeader") or {}
        raise BeachApiError(f"{op} gateway: {hdr.get('errMsg') or hdr.get('returnAuthMsg') or hdr}")

    header = (payload.get("response") or {}).get("header") or {}
    code = str(header.get("resultCode", ""))
    if code and code not in ("00", "0000"):
        raise BeachApiError(f"{op} {code}: {header.get('resultMsg')}")
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


def _latest_category(items: list[dict[str, Any]], cats: set[str]) -> dict[str, str]:
    """Pick nearest forecast row values for category codes."""
    rows: list[tuple[str, str, str, str]] = []
    for it in items:
        cat = str(it.get("category") or "")
        if cat not in cats:
            continue
        fd = str(it.get("fcstDate") or it.get("baseDate") or "")
        ft = str(it.get("fcstTime") or it.get("baseTime") or "")
        val = str(it.get("fcstValue") or it.get("obsrValue") or "")
        rows.append((fd, ft, cat, val))
    rows.sort()
    out: dict[str, str] = {}
    for _fd, _ft, cat, val in rows:
        if cat not in out and val not in ("", "-"):
            out[cat] = val
    return out


def _parse_ultra(items: list[dict[str, Any]]) -> dict[str, Any]:
    vals = _latest_category(items, {"T1H", "SKY", "PTY", "REH", "WSD", "RN1", "VEC"})
    sky = vals.get("SKY", "")
    pty = vals.get("PTY", "0")
    temp = vals.get("T1H")
    label = PTY_LABEL.get(pty) or SKY_LABEL.get(sky) or "예보"
    return {
        "temp_c": _to_float(temp),
        "sky": sky,
        "pty": pty,
        "humidity": _to_float(vals.get("REH")),
        "wind_ms": _to_float(vals.get("WSD")),
        "precip": vals.get("RN1") or "",
        "label": label,
        "cond": _kma_cond(sky, pty),
    }


def _parse_vilage(items: list[dict[str, Any]]) -> dict[str, Any]:
    vals = _latest_category(items, {"TMP", "SKY", "PTY", "POP", "REH", "WSD", "WAV"})
    return {
        "temp_c": _to_float(vals.get("TMP")),
        "sky": vals.get("SKY", ""),
        "pty": vals.get("PTY", "0"),
        "pop": _to_float(vals.get("POP")),
        "humidity": _to_float(vals.get("REH")),
        "wind_ms": _to_float(vals.get("WSD")),
        "wave_m": _to_float(vals.get("WAV")),
        "label": PTY_LABEL.get(vals.get("PTY", "0")) or SKY_LABEL.get(vals.get("SKY", ""), "예보"),
        "cond": _kma_cond(vals.get("SKY", ""), vals.get("PTY", "0")),
    }


def _parse_tide(items: list[dict[str, Any]]) -> list[dict[str, str]]:
    out = []
    for it in items[:8]:
        out.append(
            {
                "time": str(it.get("tph_time") or it.get("ti") or it.get("tide_time") or ""),
                "level": str(it.get("tph_level") or it.get("hl") or it.get("tide_level") or ""),
                "code": str(it.get("hl_code") or it.get("code") or ""),
            }
        )
    return [x for x in out if x["time"] or x["level"]]


def _parse_sun(items: list[dict[str, Any]]) -> dict[str, str]:
    if not items:
        return {}
    it = items[0]
    return {
        "sunrise": str(it.get("sunrise") or it.get("sunrise_time") or it.get("locdate") or ""),
        "sunset": str(it.get("sunset") or it.get("sunset_time") or ""),
        "raw": {k: str(v) for k, v in it.items() if k in ("sunrise", "sunset", "locdate", "longitude", "latitude")},
    }


def _to_float(v: Any) -> float | None:
    try:
        if v is None or v == "" or v == "-":
            return None
        return float(v)
    except (TypeError, ValueError):
        return None


def _kma_cond(sky: str, pty: str) -> str:
    if pty in ("1", "4", "5"):
        return "rain"
    if pty in ("2", "6"):
        return "rain"
    if pty in ("3", "7"):
        return "snow"
    if sky == "1":
        return "sunny"
    if sky == "3":
        return "partly_cloudy"
    if sky == "4":
        return "cloudy"
    return "cloudy"


def fetch_beach_bundle(beach_num: int, *, service_key: str | None = None) -> dict[str, Any]:
    key = service_key or get_beach_service_key()
    bd_u, bt_u = _base_date_time_ultra()
    bd_v, bt_v = _base_date_time_vilage()
    today = _now_kst().strftime("%Y%m%d")

    ultra_items = _items(
        _call(
            "getUltraSrtFcstBeach",
            {"base_date": bd_u, "base_time": bt_u, "beach_num": beach_num},
            service_key=key,
        )
    )
    vilage_items = _items(
        _call(
            "getVilageFcstBeach",
            {"base_date": bd_v, "base_time": bt_v, "beach_num": beach_num},
            service_key=key,
        )
    )
    tide_items = _items(
        _call(
            "getTideInfoBeach",
            {"base_date": today, "beach_num": beach_num, "numOfRows": 20},
            service_key=key,
        )
    )
    sun_items = _items(
        _call(
            "getSunInfoBeach",
            {"base_date": today, "beach_num": beach_num},
            service_key=key,
        )
    )

    ultra = _parse_ultra(ultra_items)
    vilage = _parse_vilage(vilage_items)
    merged_temp = ultra.get("temp_c")
    if merged_temp is None:
        merged_temp = vilage.get("temp_c")
    return {
        "beach_num": beach_num,
        "source": "kma_BeachInfoservice",
        "base": {"ultra": f"{bd_u}{bt_u}", "vilage": f"{bd_v}{bt_v}", "date": today},
        "temp_c": merged_temp,
        "label": ultra.get("label") or vilage.get("label") or "예보",
        "cond": ultra.get("cond") or vilage.get("cond") or "cloudy",
        "humidity": ultra.get("humidity") if ultra.get("humidity") is not None else vilage.get("humidity"),
        "wind_ms": ultra.get("wind_ms") if ultra.get("wind_ms") is not None else vilage.get("wind_ms"),
        "wave_m": vilage.get("wave_m"),
        "pop": vilage.get("pop"),
        "tide": _parse_tide(tide_items),
        "sun": _parse_sun(sun_items),
        "ultra": ultra,
        "vilage": vilage,
    }


def sync_gangwon_beach_weather(*, service_key: str | None = None) -> dict[str, Any]:
    key = service_key or get_beach_service_key()
    beaches = load_featured_beaches()
    items: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    for b in beaches:
        num = int(b["beach_num"])
        try:
            wx = fetch_beach_bundle(num, service_key=key)
            items.append({**b, "weather": wx})
        except BeachApiError as e:
            errors.append({"beach_num": str(num), "name": b.get("name", ""), "error": str(e)})
            items.append({**b, "weather": None})

    payload = {
        "updated_at": _now_kst().isoformat(timespec="minutes"),
        "api": BEACH_API_BASE,
        "ops": [
            "getUltraSrtFcstBeach",
            "getVilageFcstBeach",
            "getTideInfoBeach",
            "getSunInfoBeach",
        ],
        "count": len(items),
        "ok": sum(1 for x in items if x.get("weather")),
        "errors": errors,
        "beaches": items,
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload

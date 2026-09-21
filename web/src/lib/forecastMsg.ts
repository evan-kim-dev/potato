import { getForecastMsg, type ForecastMsgPayload } from "@/lib/data";

const API_BASE = "https://apis.data.go.kr/1360000/VilageFcstMsgService";

const ATTRIBUTION = {
  license: "공공누리 제1유형(출처표시)",
  author: "기상청",
  source_name: "기상청_단기예보 통보문 조회서비스",
  source_url: "https://www.data.go.kr/data/15058629/openapi.do",
  notice:
    "본 저작물은 공공누리 제1유형에 따라 기상청에서 공공누리로 개방한 「단기예보 통보문」을 이용하였으며, 출처는 기상청입니다.",
};

const TARGETS = {
  situation: [
    { stnId: "105", label: "강원영동(강릉)" },
    { stnId: "101", label: "강원영서(춘천)" },
  ],
  land: [
    { regId: "11D20000", label: "강원영동" },
    { regId: "11D10000", label: "강원영서" },
  ],
  sea: [{ regId: "12C20000", label: "동해중부해상" }],
} as const;

function getServiceKey() {
  return (
    process.env.KMA_FCST_MSG_SERVICE_KEY ||
    process.env.KMA_BEACH_SERVICE_KEY ||
    process.env.TOUR_API_SERVICE_KEY ||
    process.env.DATA_GO_KR_SERVICE_KEY ||
    ""
  ).trim();
}

function fmtTm(tm: unknown) {
  const s = String(tm || "").trim();
  if (s.length >= 12 && /^\d+$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(8, 10)}:${s.slice(10, 12)}`;
  }
  if (s.length >= 10 && /^\d+$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(8, 10)}:00`;
  }
  return s;
}

function cleanText(v: unknown) {
  if (v == null) return "";
  const text = String(v).trim();
  if (!text || text === "null" || text === "None" || text === "-") return "";
  return text.replace(/\\n/g, "\n");
}

async function callKma(op: string, params: Record<string, string>, key: string) {
  const q = new URLSearchParams({
    serviceKey: key,
    dataType: "JSON",
    numOfRows: "20",
    pageNo: "1",
    ...params,
  });
  // serviceKey may already be URL-encoded from portal
  const url = `${API_BASE}/${op}?${q.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  });
  const raw = await res.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error(`${op} invalid JSON`);
  }
  if (payload.OpenAPI_ServiceResponse) {
    const hdr =
      ((payload.OpenAPI_ServiceResponse as Record<string, unknown>).cmmMsgHeader as Record<
        string,
        unknown
      >) || {};
    throw new Error(`${op} gateway: ${hdr.errMsg || hdr.returnAuthMsg || "auth"}`);
  }
  const header =
    ((payload.response as Record<string, unknown>)?.header as Record<string, unknown>) || {};
  const code = String(header.resultCode || "");
  if (code && code !== "00" && code !== "0000") {
    throw new Error(`${op} ${code}: ${header.resultMsg || ""}`);
  }
  return payload;
}

function itemsOf(payload: Record<string, unknown>) {
  const body = ((payload.response as Record<string, unknown>)?.body || {}) as Record<
    string,
    unknown
  >;
  const items = (body.items || {}) as Record<string, unknown>;
  const raw = items.item;
  if (!raw) return [] as Record<string, unknown>[];
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  return [raw as Record<string, unknown>];
}

async function fetchSituation(stnId: string, key: string) {
  const items = itemsOf(await callKma("getWthrSituation", { stnId }, key));
  if (!items.length) return { stnId, empty: true };
  const it = items[0];
  return {
    stnId: String(it.stnId || stnId),
    tmFc: fmtTm(it.tmFc),
    overview: cleanText(it.wfSv1),
    warning: cleanText(it.wn),
    pre_warning: cleanText(it.wr),
  };
}

async function fetchLand(regId: string, key: string) {
  const items = itemsOf(await callKma("getLandFcst", { regId }, key));
  const periods = items.map((it) => ({
    numEf: it.numEf,
    announceTime: fmtTm(it.announceTime || it.tmFc),
    wf: cleanText(it.wf),
    wfCd: cleanText(it.wfCd),
    ta: cleanText(it.ta),
    rnSt: cleanText(it.rnSt),
    wd1: cleanText(it.wd1),
    wd2: cleanText(it.wd2),
    wsIt: cleanText(it.wsIt),
  }));
  return {
    regId,
    announceTime: periods[0]?.announceTime || "",
    periods: periods.slice(0, 8),
  };
}

async function fetchSea(regId: string, key: string) {
  const items = itemsOf(await callKma("getSeaFcst", { regId }, key));
  const periods = items.map((it) => ({
    numEf: it.numEf,
    announceTime: fmtTm(it.announceTime || it.tmFc),
    wf: cleanText(it.wf),
    wh: cleanText(it.wh || it.wav),
    wd1: cleanText(it.wd1),
    wd2: cleanText(it.wd2),
    wsIt: cleanText(it.wsIt),
  }));
  return {
    regId,
    announceTime: periods[0]?.announceTime || "",
    periods: periods.slice(0, 8),
  };
}

async function fetchFromKma(key: string): Promise<ForecastMsgPayload> {
  const errors: Array<{ op: string; id: string; error: string }> = [];

  const situation = await Promise.all(
    TARGETS.situation.map(async (t) => {
      try {
        return { ...t, data: await fetchSituation(t.stnId, key) };
      } catch (e) {
        errors.push({
          op: "getWthrSituation",
          id: t.stnId,
          error: e instanceof Error ? e.message : "fail",
        });
        return { ...t, data: null };
      }
    })
  );

  const land = await Promise.all(
    TARGETS.land.map(async (t) => {
      try {
        return { ...t, data: await fetchLand(t.regId, key) };
      } catch (e) {
        errors.push({
          op: "getLandFcst",
          id: t.regId,
          error: e instanceof Error ? e.message : "fail",
        });
        return { ...t, data: null };
      }
    })
  );

  const sea = await Promise.all(
    TARGETS.sea.map(async (t) => {
      try {
        return { ...t, data: await fetchSea(t.regId, key) };
      } catch (e) {
        errors.push({
          op: "getSeaFcst",
          id: t.regId,
          error: e instanceof Error ? e.message : "fail",
        });
        return { ...t, data: null };
      }
    })
  );

  const ok = [...situation, ...land, ...sea].filter((x) => x.data).length;
  if (!ok) throw new Error(errors[0]?.error || "기상청 통보문 응답이 비어 있습니다.");

  return {
    stub: false,
    updated_at: new Date().toISOString(),
    attribution: ATTRIBUTION,
    situation,
    land,
    sea,
  };
}

type OmniPoint = { label: string; lat: number; lng: number; kind: "land" | "sea" };

async function openMeteoFallback(): Promise<ForecastMsgPayload> {
  const points: OmniPoint[] = [
    { label: "강원영동(강릉)", lat: 37.7519, lng: 128.8761, kind: "land" },
    { label: "강원영서(춘천)", lat: 37.8813, lng: 127.73, kind: "land" },
    { label: "동해중부해상", lat: 37.7, lng: 129.4, kind: "sea" },
  ];
  const lats = points.map((p) => p.lat).join(",");
  const lngs = points.map((p) => p.lng).join(",");
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}` +
    `&current=temperature_2m,weather_code,wind_speed_10m` +
    `&hourly=temperature_2m,weather_code,precipitation_probability,wind_speed_10m,wave_height` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max` +
    `&timezone=Asia%2FSeoul&forecast_days=2`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const raw = await res.json();
  const entries = Array.isArray(raw) ? raw : [raw];

  const wmoLabel = (code: number) => {
    if (code === 0) return "맑음";
    if (code === 1 || code === 2) return "구름 조금";
    if (code === 3) return "흐림";
    if (code === 45 || code === 48) return "안개";
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "비";
    if ([71, 73, 75, 85, 86].includes(code)) return "눈";
    if ([95, 96, 99].includes(code)) return "뇌우";
    return "구름";
  };

  const situation = points.slice(0, 2).map((p, i) => {
    const e = entries[i] || {};
    const cur = e.current || {};
    const daily = e.daily || {};
    const temp = cur.temperature_2m;
    const code = Number(cur.weather_code ?? 3);
    const hi = daily.temperature_2m_max?.[0];
    const lo = daily.temperature_2m_min?.[0];
    const pop = daily.precipitation_probability_max?.[0];
    const overview = [
      `현재 ${temp != null ? `${Math.round(temp)}°C` : "—"} · ${wmoLabel(code)}`,
      hi != null && lo != null ? `오늘 ${Math.round(lo)}~${Math.round(hi)}°C` : "",
      pop != null ? `강수확률 최대 ${pop}%` : "",
      cur.wind_speed_10m != null ? `바람 ${Math.round(cur.wind_speed_10m)}km/h` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      label: p.label,
      stnId: TARGETS.situation[i]?.stnId,
      data: {
        tmFc: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
        overview,
        warning: "",
        pre_warning: "",
      },
    };
  });

  const land = points.slice(0, 2).map((p, i) => {
    const e = entries[i] || {};
    const hourly = e.hourly || {};
    const times: string[] = hourly.time || [];
    const periods = [];
    for (let h = 0; h < Math.min(times.length, 24); h += 6) {
      const code = Number(hourly.weather_code?.[h] ?? 3);
      const ta = hourly.temperature_2m?.[h];
      const rn = hourly.precipitation_probability?.[h];
      periods.push({
        announceTime: times[h]?.replace("T", " ") || "",
        wf: wmoLabel(code),
        ta: ta != null ? String(Math.round(ta)) : "",
        rnSt: rn != null ? String(rn) : "",
      });
    }
    return {
      label: TARGETS.land[i]?.label || p.label,
      regId: TARGETS.land[i]?.regId,
      data: {
        announceTime: periods[0]?.announceTime || "",
        periods,
      },
    };
  });

  const seaEntry = entries[2] || entries[0] || {};
  const seaHourly = seaEntry.hourly || {};
  const seaTimes: string[] = seaHourly.time || [];
  const seaPeriods = [];
  for (let h = 0; h < Math.min(seaTimes.length, 24); h += 6) {
    const code = Number(seaHourly.weather_code?.[h] ?? 3);
    const wh = seaHourly.wave_height?.[h];
    const ws = seaHourly.wind_speed_10m?.[h];
    seaPeriods.push({
      announceTime: seaTimes[h]?.replace("T", " ") || "",
      wf: wmoLabel(code),
      wh: wh != null ? `${Number(wh).toFixed(1)}m` : "",
      wsIt: ws != null ? `${Math.round(ws)}km/h` : "",
    });
  }

  return {
    stub: false,
    reason:
      "지금은 Open-Meteo 실시간 요약으로 보여 드립니다. 기상청 공식 통보문 연동 시 같은 화면에서 전환됩니다.",
    updated_at: new Date().toISOString(),
    attribution: {
      ...ATTRIBUTION,
      author: "Open-Meteo",
      notice:
        "강원 영동·영서 요약을 Open-Meteo 관측·예보로 구성했습니다. 공식 특보·통보문은 기상청을 기준으로 확인해 주세요.",
    },
    situation,
    land,
    sea: [
      {
        label: "동해중부해상",
        regId: "12C20000",
        data: {
          announceTime: seaPeriods[0]?.announceTime || "",
          periods: seaPeriods,
        },
      },
    ],
  };
}

/** 서버: 기상청 키 → SSOT 실데이터 → Open-Meteo 보조 */
let fcstResolveCache: {
  at: number;
  value: ForecastMsgPayload & { source: string };
} | null = null;
const FCST_RESOLVE_TTL = 3 * 60 * 1000;

export async function resolveForecastPayload(): Promise<ForecastMsgPayload & { source: string }> {
  if (fcstResolveCache && Date.now() - fcstResolveCache.at < FCST_RESOLVE_TTL) {
    return fcstResolveCache.value;
  }

  const key = getServiceKey();
  if (key) {
    try {
      const live = await fetchFromKma(key);
      const value = { ...live, source: "kma" as const };
      fcstResolveCache = { at: Date.now(), value };
      return value;
    } catch {
      /* fall through */
    }
  }

  const file = getForecastMsg();
  const hasData = [...(file.situation || []), ...(file.land || []), ...(file.sea || [])].some(
    (row) => row?.data
  );
  if (!file.stub && hasData) {
    const value = { ...file, source: "ssot" as const };
    fcstResolveCache = { at: Date.now(), value };
    return value;
  }

  try {
    const fallback = await openMeteoFallback();
    const value = { ...fallback, source: "open-meteo" as const };
    fcstResolveCache = { at: Date.now(), value };
    return value;
  } catch (e) {
    return {
      ...file,
      stub: true,
      reason:
        file.reason ||
        (e instanceof Error ? e.message : "통보문을 불러오지 못했어요"),
      source: "stub",
    };
  }
}

import { NextResponse } from "next/server";
import { existsSync, readdirSync, statSync } from "fs";
import path from "path";
import {
  getFestivals,
  getQuietGems,
  getRegionCongestionMap,
  getSpots,
} from "@/lib/data";
import { QUIET_REGIONS } from "@/lib/prefs";
import { getSeedMerchants } from "@/lib/merchants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SSOT_FILES = [
  "tour_kor_spots.json",
  "tour_kor_festivals.json",
  "tour_hub_spots.json",
  "tour_eco_spots.json",
  "tour_region_photos.json",
  "tour_regional_insights.json",
  "tour_relate_spots.json",
  "tour_visitor_stats.json",
  "tour_concentration.json",
  "tour_demand_intensity.json",
  "tour_diversity.json",
  "tour_resource_demand.json",
  "tour_beach_weather.json",
  "forecast_msg.json",
  "kto_aggregated_spots.json",
  "catalog.json",
  "local_merchants.json",
  "komsco_payments.json",
] as const;

function resolveDataDir() {
  const candidates = [
    path.join(/*turbopackIgnore: true*/ process.cwd(), "data"),
    path.join(/*turbopackIgnore: true*/ process.cwd(), "..", "backend", "data"),
    path.join(/*turbopackIgnore: true*/ process.cwd(), "backend", "data"),
  ];
  for (const p of candidates) {
    if (existsSync(/*turbopackIgnore: true*/ p)) return p;
  }
  return candidates[0];
}

function envFlag(name: string) {
  return Boolean((process.env[name] || "").trim());
}

export async function GET() {
  const dataDir = resolveDataDir();
  const files = SSOT_FILES.map((name) => {
    const full = path.join(/*turbopackIgnore: true*/ dataDir, name);
    if (!existsSync(/*turbopackIgnore: true*/ full)) {
      return { name, ok: false, bytes: 0, mtime: null as string | null };
    }
    const st = statSync(/*turbopackIgnore: true*/ full);
    return {
      name,
      ok: st.size > 0,
      bytes: st.size,
      mtime: st.mtime.toISOString(),
    };
  });

  const spots = getSpots();
  const festivals = getFestivals();
  const gems = getQuietGems(20);
  const congestion = getRegionCongestionMap();
  const highCongestion = Object.entries(congestion)
    .filter(([, v]) => v.level === "high")
    .map(([region, v]) => ({ region, label: v.label }))
    .slice(0, 6);

  let merchantCount = 0;
  try {
    merchantCount = getSeedMerchants().length;
  } catch {
    merchantCount = 0;
  }

  let dataFileCount = 0;
  try {
    dataFileCount = readdirSync(/*turbopackIgnore: true*/ dataDir).filter((f) =>
      f.endsWith(".json")
    ).length;
  } catch {
    dataFileCount = files.filter((f) => f.ok).length;
  }

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    dataDir: path.basename(path.dirname(dataDir)) + "/" + path.basename(dataDir),
    dataFileCount,
    ssot: {
      present: files.filter((f) => f.ok).length,
      total: files.length,
      files,
    },
    catalog: {
      spots: spots.length,
      festivals: festivals.length,
      quietGems: gems.length,
      quietRegions: QUIET_REGIONS.length,
      merchants: merchantCount,
    },
    congestionHigh: highCongestion,
    env: {
      kakaoJs: envFlag("NEXT_PUBLIC_KAKAO_JS_KEY"),
      kakaoRest: envFlag("KAKAO_REST_KEY"),
      gemini: envFlag("GOOGLE_API_KEY") || envFlag("GEMINI_API_KEY"),
      dataGoKr: envFlag("DATA_GO_KR_SERVICE_KEY") || envFlag("TOUR_API_SERVICE_KEY"),
    },
    komscoCache: files.find((f) => f.name === "komsco_payments.json")?.ok ?? false,
  });
}

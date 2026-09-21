import { ForecastBoard } from "@/components/ForecastBoard";
import { WeatherBoard } from "@/components/WeatherBoard";
import { PageShell } from "@/components/ui";
import { getBeachRows, getCities } from "@/lib/data";
import { fetchBeachLiveWeather } from "@/lib/beachWeather";
import { resolveForecastPayload } from "@/lib/forecastMsg";
import { fetchGangwonWeather, type WeatherCard } from "@/lib/weather";
import Link from "next/link";

export const revalidate = 600;

export default async function WeatherPage() {
  const cities = getCities();
  const beachRows = getBeachRows();

  const [wx, beachRes, fcstRes] = await Promise.allSettled([
    fetchGangwonWeather(cities),
    fetchBeachLiveWeather(beachRows),
    resolveForecastPayload(),
  ]);

  let initial: WeatherCard[] = [];
  let error = "";
  if (wx.status === "fulfilled") initial = wx.value;
  else error = wx.reason instanceof Error ? wx.reason.message : "날씨를 불러오지 못했어요";

  const beaches =
    beachRes.status === "fulfilled"
      ? beachRes.value
      : beachRows.map((b) => ({
          ...b,
          liveTemp: b.weather?.temp_c ?? null,
          liveLabel: b.weather?.label || "불러오는 중",
          liveIcon: "🌊",
          tip: "실시간 기온을 불러오지 못했어요",
        }));

  const fcst =
    fcstRes.status === "fulfilled" && fcstRes.value
      ? fcstRes.value
      : {
          stub: false,
          reason: "통보문을 불러오지 못했어요. 새로고침을 눌러 주세요.",
          situation: [],
          land: [],
          sea: [],
          source: "error",
        };

  return (
    <PageShell className="space-y-12">
      {error ? (
        <p className="ui-panel p-5 text-sm text-red-700">
          {error} · 아래에서 다시 불러올 수 있어요.
        </p>
      ) : null}
      <WeatherBoard initial={initial} beaches={beaches} />
      <ForecastBoard payload={fcst} />
      <p className="text-center text-[0.78rem] text-muted">
        시·군·해안 기온은 Open-Meteo · 통보문은 기상청 연동 시 공식 자료 ·{" "}
        <Link
          href="/?ask=%ED%95%9C%EC%82%B0%20%EA%B6%8C%EC%97%AD%20%EB%82%A0%EC%94%A8%20%EB%A7%9E%EB%8A%94%20%EC%BD%94%EC%8A%A4"
          className="font-semibold text-sea underline-offset-2 hover:underline"
        >
          한산 권역 코스 물어보기
        </Link>
      </p>
    </PageShell>
  );
}

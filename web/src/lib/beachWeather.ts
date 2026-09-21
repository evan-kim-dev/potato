import type { Beach } from "@/lib/data";

export type BeachCard = Beach & {
  liveTemp: number | null;
  liveLabel: string;
  liveIcon: string;
  tip: string;
};

function wmoLabel(code: number) {
  if (code === 0) return { icon: "☀", label: "맑음" };
  if (code === 1 || code === 2) return { icon: "⛅", label: "구름 조금" };
  if (code === 3) return { icon: "☁", label: "흐림" };
  if ([61, 63, 65, 80, 81, 82].includes(code)) return { icon: "🌧", label: "비" };
  if ([71, 73, 75].includes(code)) return { icon: "❄", label: "눈" };
  return { icon: "🌊", label: "바다" };
}

export async function fetchBeachLiveWeather(beaches: Beach[]): Promise<BeachCard[]> {
  if (!beaches.length) return [];
  const chunkSize = 6;
  const out: BeachCard[] = [];

  for (let i = 0; i < beaches.length; i += chunkSize) {
    const chunk = beaches.slice(i, i + chunkSize);
    const lats = chunk.map((b) => b.lat).join(",");
    const lngs = chunk.map((b) => b.lng).join(",");
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}` +
      `&current=temperature_2m,weather_code&timezone=Asia%2FSeoul`;
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) throw new Error(`해변 날씨 API ${res.status}`);
    const raw = await res.json();
    const entries = Array.isArray(raw) ? raw : [raw];

    chunk.forEach((beach, idx) => {
      const entry = entries[idx] || entries[0];
      const kmaTemp = beach.weather?.temp_c;
      const live = Math.round(Number(entry?.current?.temperature_2m ?? NaN));
      const code = Number(entry?.current?.weather_code ?? 0);
      const meta = wmoLabel(code);
      const temp = kmaTemp != null ? Math.round(Number(kmaTemp)) : Number.isFinite(live) ? live : null;
      const tips: string[] = [];
      if (beach.weather?.wave_m != null) tips.push(`파고 ${beach.weather.wave_m}m`);
      if (beach.weather?.wind_ms != null) tips.push(`바람 ${beach.weather.wind_ms}m/s`);
      if (beach.weather?.pop != null) tips.push(`강수확률 ${beach.weather.pop}%`);
      if (!tips.length) tips.push(meta.label);
      out.push({
        ...beach,
        liveTemp: temp,
        liveLabel: beach.weather?.label || meta.label,
        liveIcon: meta.icon,
        tip: tips.slice(0, 2).join(" · "),
      });
    });
  }
  return out;
}

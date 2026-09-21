export type WeatherCondition =
  | "sunny"
  | "partly_cloudy"
  | "cloudy"
  | "fog"
  | "rain"
  | "snow"
  | "thunder";

export type WeatherCard = {
  city: string;
  temp: number | null;
  cond: WeatherCondition;
  icon: string;
  label: string;
  range: string;
  tip: string;
  updatedAt: string;
};

const ICONS: Record<WeatherCondition, { icon: string; label: string }> = {
  sunny: { icon: "☀", label: "맑음" },
  partly_cloudy: { icon: "⛅", label: "구름 조금" },
  cloudy: { icon: "☁", label: "흐림" },
  fog: { icon: "🌫", label: "안개" },
  rain: { icon: "🌧", label: "비" },
  snow: { icon: "❄", label: "눈" },
  thunder: { icon: "⛈", label: "뇌우" },
};

function wmoToCondition(code: number): WeatherCondition {
  if (code === 0) return "sunny";
  if (code === 1 || code === 2) return "partly_cloudy";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "thunder";
  return "cloudy";
}

function weatherTip(temp: number, cond: WeatherCondition, hi?: number, lo?: number) {
  const tips: string[] = [];
  if (hi != null && lo != null) {
    const diff = Math.round(hi - lo);
    if (diff >= 8) tips.push(`일교차 ${diff}°C · 겉옷 챙기기`);
    else if (diff >= 5) tips.push("일교차 있음 · 가벼운 겉옷");
  }
  if (temp <= 3) tips.push("체감 추움 · 방한");
  else if (temp >= 28) tips.push("더움 · 수분·자외선");
  if (cond === "rain") tips.push("우산");
  else if (cond === "snow") tips.push("미끄럼 주의");
  else if (cond === "fog") tips.push("운전 시야 주의");
  else if (cond === "thunder") tips.push("실외 활동 주의");
  else if ((cond === "sunny" || cond === "partly_cloudy") && temp >= 8 && temp <= 22) {
    tips.push("산책·드라이브 좋은 날");
  }
  if (!tips.length) tips.push("외출 전 현지 날씨 확인");
  return tips.slice(0, 2).join(" · ");
}

type City = { city: string; lat: number; lng: number };

export async function fetchGangwonWeather(cities: City[]): Promise<WeatherCard[]> {
  const chunkSize = 6;
  const out: WeatherCard[] = [];

  for (let i = 0; i < cities.length; i += chunkSize) {
    const chunk = cities.slice(i, i + chunkSize);
    const lats = chunk.map((c) => c.lat).join(",");
    const lngs = chunk.map((c) => c.lng).join(",");
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}` +
      `&current=temperature_2m,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul`;
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) throw new Error(`날씨 API ${res.status}`);
    const raw = await res.json();
    const entries = Array.isArray(raw) ? raw : [raw];

    chunk.forEach((city, idx) => {
      const entry = entries[idx] || entries[0];
      const temp = Math.round(Number(entry?.current?.temperature_2m ?? NaN));
      const code = Number(entry?.current?.weather_code ?? 3);
      const hi = entry?.daily?.temperature_2m_max?.[0];
      const lo = entry?.daily?.temperature_2m_min?.[0];
      const cond = wmoToCondition(code);
      const meta = ICONS[cond];
      out.push({
        city: city.city,
        temp: Number.isFinite(temp) ? temp : null,
        cond,
        icon: meta.icon,
        label: meta.label,
        range: hi != null && lo != null ? `${Math.round(lo)}° ~ ${Math.round(hi)}°` : "",
        tip: weatherTip(Number.isFinite(temp) ? temp : 0, cond, hi, lo),
        updatedAt: entry?.current?.time || "",
      });
    });
  }

  return out;
}

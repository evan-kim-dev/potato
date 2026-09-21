/** 홈·날씨 지도 SVG 공유 캐시 (한 번만 fetch) */
let heroSvgPromise: Promise<string> | null = null;

export function loadGangwonHeroSvg() {
  if (!heroSvgPromise) {
    heroSvgPromise = fetch("/assets/gangwon-hero.svg").then(async (res) => {
      if (!res.ok) throw new Error(`지도 ${res.status}`);
      return res.text();
    });
  }
  return heroSvgPromise;
}

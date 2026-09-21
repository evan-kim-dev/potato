/**
 * Kakao 지도 Web API — https://apis.map.kakao.com/web/guide/
 *
 * 준비: Developers → 앱 → 앱 설정 → 플랫폼 키 → JavaScript Key
 *       → JavaScript SDK 도메인 등록 (예: http://localhost:3000)
 * 시작: #map 영역 + sdk.js?appkey=… (+ libraries) + new kakao.maps.Map
 */

declare global {
  interface Window {
    kakao?: {
      maps: {
        load?: (cb: () => void) => void;
        LatLng: new (lat: number, lng: number) => KakaoLatLng;
        Map: new (
          container: HTMLElement,
          options: { center: KakaoLatLng; level: number }
        ) => KakaoMap;
        Marker: new (options: {
          position: KakaoLatLng;
          map?: KakaoMap;
          title?: string;
        }) => KakaoMarker;
        Polyline: new (options: {
          path: KakaoLatLng[];
          strokeWeight?: number;
          strokeColor?: string;
          strokeOpacity?: number;
          strokeStyle?: string;
          map?: KakaoMap;
        }) => KakaoPolyline;
        InfoWindow: new (options: { content: string }) => KakaoInfoWindow;
        event: {
          addListener: (target: unknown, type: string, handler: () => void) => void;
        };
        LatLngBounds: new () => KakaoLatLngBounds;
      };
    };
  }
}

export type KakaoLatLng = { getLat: () => number; getLng: () => number };
export type KakaoMap = {
  setCenter: (latlng: KakaoLatLng) => void;
  setLevel: (level: number) => void;
  setBounds: (bounds: KakaoLatLngBounds, padding?: number) => void;
  relayout?: () => void;
};
export type KakaoMarker = {
  setMap: (map: KakaoMap | null) => void;
  setPosition: (latlng: KakaoLatLng) => void;
};
export type KakaoPolyline = { setMap: (map: KakaoMap | null) => void };
export type KakaoInfoWindow = {
  open: (map: KakaoMap, marker: KakaoMarker) => void;
  close: () => void;
};
export type KakaoLatLngBounds = {
  extend: (latlng: KakaoLatLng) => void;
};

let loadPromise: Promise<NonNullable<typeof window.kakao>> | null = null;

export function getKakaoJsKey() {
  return (process.env.NEXT_PUBLIC_KAKAO_JS_KEY || "").trim();
}

/**
 * 가이드: //dapi.kakao.com/v2/maps/sdk.js?appkey=…
 * 라이브러리: services,clusterer,drawing
 * @see https://apis.map.kakao.com/web/guide/
 */
export function kakaoSdkSrc(appkey: string, withLibraries = true) {
  const base = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appkey)}`;
  return withLibraries
    ? `${base}&libraries=services,clusterer,drawing`
    : base;
}

export function resetKakaoMapsLoader() {
  loadPromise = null;
}

function mapsReady(): boolean {
  return Boolean(window.kakao?.maps?.LatLng && window.kakao?.maps?.Map);
}

/** 가이드: 스크립트 로드 후 new kakao.maps.Map — 실행 코드보다 스크립트가 먼저여야 함 */
export function loadKakaoMaps(): Promise<NonNullable<typeof window.kakao>> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("browser only"));
  }
  if (mapsReady()) return Promise.resolve(window.kakao!);

  const key = getKakaoJsKey();
  if (!key) return Promise.reject(new Error("NEXT_PUBLIC_KAKAO_JS_KEY 없음"));

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      let settled = false;
      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        loadPromise = null;
        reject(err);
      };
      const ok = () => {
        if (settled) return;
        if (!mapsReady()) {
          fail(new Error("카카오맵 모듈 초기화 실패"));
          return;
        }
        settled = true;
        resolve(window.kakao!);
      };

      const timer = window.setTimeout(() => {
        fail(
          new Error(
            "카카오맵 응답 없음 · JavaScript SDK 도메인에 http://localhost:3000 등을 등록하세요 (apis.map.kakao.com/web/guide)"
          )
        );
      }, 8000);

      const afterScript = () => {
        if (mapsReady()) {
          window.clearTimeout(timer);
          ok();
          return;
        }
        // autoload=false 로 로드된 경우만
        if (typeof window.kakao?.maps?.load === "function") {
          try {
            window.kakao.maps.load(() => {
              window.clearTimeout(timer);
              ok();
            });
            return;
          } catch (e) {
            window.clearTimeout(timer);
            fail(e instanceof Error ? e : new Error("카카오맵 로드 오류"));
            return;
          }
        }
        window.clearTimeout(timer);
        fail(
          new Error(
            "카카오맵 SDK 실패 · 카카오맵 ON + JS SDK 도메인 등록을 확인하세요"
          )
        );
      };

      const existing = document.querySelector<HTMLScriptElement>(
        "script[data-kakao-maps], script[src*='dapi.kakao.com/v2/maps/sdk.js']"
      );
      if (existing) {
        if (mapsReady()) {
          window.clearTimeout(timer);
          ok();
          return;
        }
        existing.addEventListener("load", afterScript, { once: true });
        existing.addEventListener(
          "error",
          () => {
            window.clearTimeout(timer);
            fail(new Error("카카오맵 스크립트 오류"));
          },
          { once: true }
        );
        let n = 0;
        const poll = window.setInterval(() => {
          n += 1;
          if (mapsReady()) {
            window.clearInterval(poll);
            window.clearTimeout(timer);
            ok();
          } else if (n > 50) {
            window.clearInterval(poll);
          }
        }, 100);
        return;
      }

      // 가이드 HTML과 동일: type=text/javascript + appkey (+ libraries)
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.dataset.kakaoMaps = "1";
      script.src = kakaoSdkSrc(key);
      script.onload = afterScript;
      script.onerror = () => {
        window.clearTimeout(timer);
        fail(new Error("카카오맵 스크립트를 불러오지 못했어요"));
      };
      document.head.appendChild(script);
    });
  }
  return loadPromise;
}

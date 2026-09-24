/**
 * Kakao 지도 Web API — https://apis.map.kakao.com/web/guide/
 *
 * 시작: #map 영역 + sdk.js?appkey=…&autoload=false (+ libraries) + kakao.maps.load
 * 그 다음 new kakao.maps.Map
 */

declare global {
  interface Window {
    kakao?: {
      maps?: {
        load: (cb: () => void) => void;
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
        LatLngBounds: new () => KakaoLatLngBounds;
        CustomOverlay: new (options: {
          position: KakaoLatLng;
          content: string | HTMLElement;
          xAnchor?: number;
          yAnchor?: number;
          zIndex?: number;
        }) => KakaoCustomOverlay;
        event: {
          addListener: (
            target: KakaoMarker | KakaoMap,
            type: string,
            handler: () => void
          ) => void;
        };
      };
    };
  }
}

export type KakaoLatLng = { getLat: () => number; getLng: () => number };
export type KakaoMap = {
  setCenter: (latlng: KakaoLatLng) => void;
  setLevel?: (level: number) => void;
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
};
export type KakaoLatLngBounds = {
  extend: (latlng: KakaoLatLng) => void;
};
export type KakaoCustomOverlay = {
  setMap: (map: KakaoMap | null) => void;
  setPosition?: (latlng: KakaoLatLng) => void;
};

let loadPromise: Promise<NonNullable<typeof window.kakao>> | null = null;

export function getKakaoJsKey() {
  return (process.env.NEXT_PUBLIC_KAKAO_JS_KEY || "").trim();
}

/**
 * 가이드: //dapi.kakao.com/v2/maps/sdk.js?appkey=…
 * autoload=false — document.write 차단 환경에서도 maps.load()로 초기화
 * @see https://apis.map.kakao.com/web/guide/
 */
/** 맵·마커·폴리라인만 쓰면 libraries 생략(용량·초기화 시간 절감). 장소검색은 /api/places 사용. */
export function kakaoSdkSrc(appkey: string, withLibraries = false) {
  const base = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appkey)}&autoload=false`;
  return withLibraries ? `${base}&libraries=services` : base;
}

export function resetKakaoMapsLoader() {
  loadPromise = null;
}

function mapsReady(): boolean {
  return Boolean(window.kakao?.maps?.LatLng && window.kakao?.maps?.Map);
}

function runMapsLoad(resolve: (v: NonNullable<typeof window.kakao>) => void, reject: (e: Error) => void) {
  const maps = window.kakao?.maps;
  if (!maps) {
    reject(new Error("카카오맵 SDK가 없습니다"));
    return;
  }
  if (mapsReady()) {
    resolve(window.kakao!);
    return;
  }
  if (typeof maps.load !== "function") {
    reject(
      new Error(
        "카카오맵 초기화 실패 · JavaScript 키 도메인에 http://localhost:3000 등록 여부를 확인하세요"
      )
    );
    return;
  }
  try {
    maps.load(() => {
      if (!mapsReady()) {
        reject(new Error("카카오맵 모듈 초기화 실패"));
        return;
      }
      resolve(window.kakao!);
    });
  } catch (e) {
    reject(e instanceof Error ? e : new Error("카카오맵 로드 오류"));
  }
}

/** 가이드: autoload=false 스크립트 후 kakao.maps.load → new kakao.maps.Map */
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
      const ok = (v: NonNullable<typeof window.kakao>) => {
        if (settled) return;
        settled = true;
        resolve(v);
      };

      const timer = window.setTimeout(() => {
        fail(
          new Error(
            "카카오맵 응답 없음 · JavaScript SDK 도메인에 http://localhost:3000 을 등록하세요"
          )
        );
      }, 10000);

      const finishLoad = () => {
        runMapsLoad(
          (v) => {
            window.clearTimeout(timer);
            ok(v);
          },
          (e) => {
            window.clearTimeout(timer);
            fail(e);
          }
        );
      };

      const existing = document.querySelector<HTMLScriptElement>(
        "script[data-kakao-maps], script[src*='dapi.kakao.com/v2/maps/sdk.js']"
      );

      if (existing) {
        if (window.kakao?.maps) {
          finishLoad();
          return;
        }
        existing.addEventListener("load", finishLoad, { once: true });
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
          if (window.kakao?.maps) {
            window.clearInterval(poll);
            finishLoad();
          } else if (n > 80) {
            window.clearInterval(poll);
          }
        }, 100);
        return;
      }

      const script = document.createElement("script");
      script.type = "text/javascript";
      script.dataset.kakaoMaps = "1";
      script.async = true;
      script.src = kakaoSdkSrc(key);
      script.onload = finishLoad;
      script.onerror = () => {
        window.clearTimeout(timer);
        fail(new Error("카카오맵 스크립트를 불러오지 못했어요"));
      };
      document.head.appendChild(script);
    });
  }
  return loadPromise;
}

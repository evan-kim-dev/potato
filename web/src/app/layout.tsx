import type { Metadata } from "next";
import { AppFooter } from "@/components/AppFooter";
import { AppNav } from "@/components/AppNav";
import { getKakaoJsKey, kakaoSdkSrc } from "@/lib/kakaoMap";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "강원 온도(ON道)",
    template: "%s · 강원 온도",
  },
  description:
    "인구감소·한산 권역 특화 AI 로컬 관광 — 영월·정선·태백 등 숨은 명소 · 혼잡 분산 · 로컬 혜택",
  applicationName: "강원 온도",
  metadataBase: new URL("https://potato-peach.vercel.app"),
  icons: {
    icon: "/assets/mascot-icon.png",
    apple: "/assets/mascot-icon.png",
  },
  openGraph: {
    title: "강원 온도(ON道)",
    description: "한산한 강원을 먼저 — AI 코스 · 혼잡 분산 · 한산 여권",
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const kakaoKey = getKakaoJsKey();
  // https://apis.map.kakao.com/web/guide/ — 실행 코드보다 스크립트를 먼저 선언
  const kakaoSdk = kakaoKey ? kakaoSdkSrc(kakaoKey) : "";

  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link rel="dns-prefetch" href="https://dapi.kakao.com" />
        <link rel="dns-prefetch" href="https://api.open-meteo.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
        {kakaoSdk ? (
          // 가이드: <script type="text/javascript" src="//dapi.kakao.com/v2/maps/sdk.js?appkey=…">
          // eslint-disable-next-line @next/next/no-sync-scripts
          <script type="text/javascript" src={kakaoSdk} data-kakao-maps="1" />
        ) : null}
      </head>
      <body className="flex min-h-dvh flex-col antialiased">
        <AppNav />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <AppFooter />
      </body>
    </html>
  );
}

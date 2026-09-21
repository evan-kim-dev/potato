import { LegalShell } from "@/components/LegalShell";

export default function CreditsPage() {
  return (
    <LegalShell
      title="출처·라이선스"
      blurb="본 서비스가 활용하는 공공데이터와 저작권 표시입니다."
      activeHref="/credits"
    >
      <section className="ui-panel p-5">
        <h2>관광 정보</h2>
        <p className="mt-3">
          <strong>한국관광공사 TourAPI</strong> (국문 관광정보·축제·생태관광 등) —{" "}
          <a
            href="https://api.visitkorea.or.kr/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-sea hover:underline"
          >
            api.visitkorea.or.kr
          </a>
        </p>
      </section>

      <section className="ui-panel p-5">
        <h2>기상·날씨</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong>기상청</strong> 해수욕장 날씨·단기예보 통보문 — 공공누리 제1유형(출처표시).{" "}
            <a
              href="https://www.data.go.kr/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-sea hover:underline"
            >
              공공데이터포털
            </a>
          </li>
          <li>
            <strong>Open-Meteo</strong> — 시·군·해변 실시간 기온 (오픈 라이선스)
          </li>
        </ul>
      </section>

      <section className="ui-panel p-5">
        <h2>지도·폰트</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>OpenStreetMap 기여자 — 일정 지도 폴백 타일</li>
          <li>Pretendard — 화면 타이포그래피</li>
        </ul>
      </section>

      <section className="ui-panel p-5">
        <h2>AI</h2>
        <p className="mt-3">
          여행 상담·코스 설명은 <strong>Google Gemini API</strong>를 통해 생성될 수 있습니다.
        </p>
      </section>
    </LegalShell>
  );
}

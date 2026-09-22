import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="story-page pt-[var(--nav-h)]">
      <section className="story-about-hero">
        <p className="story-brand">소개</p>
        <h1 className="story-headline story-headline-sm">
          비어 가는 지도에
          <br />
          따뜻한 발길을 남기다
        </h1>
        <p className="story-lead">
          강원 온도(ON道)는 인구감소·한산 권역을 먼저 큐레이션하는 로컬 여행 서비스입니다.
        </p>
      </section>

      <section className="story-about-prose">
        <h2>왜 만들었나요</h2>
        <p>
          강원 여행은 종종 해안 핫플 몇 곳에 몰립니다. 그사이 영월·정선·태백·양구·인제처럼
          사람이 줄어드는 권역은 관광에서도 한발 밀려납니다. 우리는 그 간극을{" "}
          <strong>데이터와 AI 동선</strong>으로 메우고 싶었습니다.
        </p>

        <h2>어떻게 돕나요</h2>
        <p>
          지도에서 한산 시·군을 고르면 지역 팁이 열리고, 온이에게 취향을 말하면 인접 권역
          저밀도 코스가 만들어집니다. 일정에는{" "}
          <strong>분산·ESG 점수</strong>, 카카오 경로, 지역화폐·관광주민증 안내가 붙고, 찜하면{" "}
          <Link href="/passport" className="font-semibold text-sea hover:underline">
            한산 여권
          </Link>{" "}
          스탬프가 쌓입니다.
        </p>

        <ul className="story-feature-grid">
          <li>
            <strong>혼잡 → 한산</strong>
            <span>해안 집중을 읽고 인접 인구감소 권역으로 우회</span>
          </li>
          <li>
            <strong>인접 동선</strong>
            <span>도를 뺑뺑 도는 코스 대신 클러스터만 이어감</span>
          </li>
          <li>
            <strong>강원페이</strong>
            <span>스탑 인근 가맹으로 체류 소비를 지역에</span>
          </li>
          <li>
            <strong>임팩트 KPI</strong>
            <span>지자체가 볼 한산 비중·클릭·여권 지표(이 기기 미리보기)</span>
          </li>
        </ul>

        <h2>공모전 킬러 포인트</h2>
        <p>
          흔한 여행 앱 기능을 늘리기보다,{" "}
          <strong>인구소멸 방지 · 관광객 분산 · ESG</strong>에 직접 연결되는 장치만
          넣었습니다. 지자체용{" "}
          <Link href="/impact" className="font-semibold text-sea hover:underline">
            임팩트 대시보드
          </Link>
          로 한산 체류 비중·혜택 클릭·여권 커버리지 같은 KPI를 미리볼 수 있습니다.
        </p>

        <h2>누가 만드나요</h2>
        <p>
          <strong>Team. 샤이한 열정 감자</strong>
          <br />
          조금 수줍지만, 우리가 만드는 변화만큼은 누구보다 뜨겁게. 강원의 모든 지역이 소외 없이
          이어지도록 따뜻한 지도를 그립니다.
        </p>
      </section>

      <section className="story-close">
        <h2 className="story-close-title">이제 지도로 가 볼까요</h2>
        <div className="story-cta !justify-center">
          <Link href="/" className="ui-btn ui-btn-primary !min-h-11 !px-5">
            홈에서 시작하기
          </Link>
          <Link href="/spots" className="ui-btn ui-btn-secondary !min-h-11 !px-5">
            명소 둘러보기
          </Link>
        </div>
      </section>
    </main>
  );
}

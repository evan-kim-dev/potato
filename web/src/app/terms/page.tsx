import { LegalShell } from "@/components/LegalShell";

export default function TermsPage() {
  return (
    <LegalShell
      title="이용약관"
      blurb="강원 온도(ON道) 이용에 관한 기본 안내입니다."
      activeHref="/terms"
    >
      <section className="ui-panel p-5">
        <h2>1. 서비스 성격</h2>
        <p className="mt-3">
          본 서비스는 강원 지역 여행 정보·AI 코스 추천을 제공하는{" "}
          <strong>비상업 목적의 공공·지역 활성화 서비스</strong>입니다. 안내는 참고용이며, 실제
          방문·교통·요금·영업 시간은 현지·공식 정보를 확인해 주세요.
        </p>
      </section>

      <section className="ui-panel p-5">
        <h2>2. 이용자 책임</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>커뮤니티에 타인을 비방하거나 불법·유해한 내용을 게시하지 않습니다.</li>
          <li>AI가 생성한 일정의 정확성을 맹신하지 않고 스스로 판단합니다.</li>
          <li>공공데이터·지도 저작권 표시를 존중합니다.</li>
        </ul>
      </section>

      <section className="ui-panel p-5">
        <h2>3. 면책</h2>
        <p className="mt-3">
          서비스 중단, 데이터 오류, AI 오답, 제3자 API 장애로 인한 손해에 대해 운영 팀은 법령이
          허용하는 범위에서 책임을 제한합니다.
        </p>
      </section>

      <section className="ui-panel p-5">
        <h2>4. 약관 변경</h2>
        <p className="mt-3">
          필요 시 본 약관을 개정할 수 있으며, 중요한 변경은 서비스 내 공지 또는 본 페이지 갱신으로
          알립니다.
        </p>
        <p className="mt-2 text-[0.72rem]">시행일: 2026-03-20</p>
      </section>
    </LegalShell>
  );
}

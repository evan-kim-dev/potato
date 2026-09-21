import { LegalShell } from "@/components/LegalShell";

export default function PrivacyPage() {
  return (
    <LegalShell
      title="개인정보처리방침"
      blurb="강원 온도(ON道)가 다루는 개인정보와 이용 목적을 안내합니다."
      activeHref="/privacy"
    >
      <section className="ui-panel p-5">
        <h2>1. 수집 항목</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>닉네임(로컬 체험 로그인 시)</li>
          <li>서비스 이용 기록(찜한 코스, 커뮤니티 글·댓글 — 브라우저 저장소)</li>
          <li>AI 상담 질의 내용(코스 생성 요청 시 서버로 전송)</li>
        </ul>
      </section>

      <section className="ui-panel p-5">
        <h2>2. 이용 목적</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>여행 코스 추천·일정 저장</li>
          <li>커뮤니티 작성자 표시</li>
          <li>서비스 개선 및 오류 대응</li>
        </ul>
      </section>

      <section className="ui-panel p-5">
        <h2>3. 보관·파기</h2>
        <p className="mt-3">
          닉네임·찜·커뮤니티 데이터는{" "}
          <strong>이용자 기기(localStorage)</strong>에 저장됩니다. 브라우저 데이터를 삭제하면
          함께 파기됩니다. 서버에 별도 회원 DB를 두지 않습니다.
        </p>
      </section>

      <section className="ui-panel p-5">
        <h2>4. 제3자 제공·처리 위탁</h2>
        <p className="mt-3">
          AI 응답 생성을 위해 질문 내용이 Google Gemini API로 전송될 수 있습니다. 관광·날씨
          조회는 한국관광공사·기상청·Open-Meteo 등 공개 API를 사용합니다.
        </p>
      </section>

      <section className="ui-panel p-5">
        <h2>5. 문의</h2>
        <p className="mt-3">
          개인정보 관련 문의는 팀 <strong>샤이한 열정 감자</strong>로 프로젝트 저장소 이슈를 통해
          남겨 주세요. 본 방침은 서비스 개선에 따라 개정될 수 있습니다.
        </p>
        <p className="mt-2 text-[0.72rem]">시행일: 2026-03-20</p>
      </section>
    </LegalShell>
  );
}

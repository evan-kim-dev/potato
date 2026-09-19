# 샤이한 열정 감자들 · 강원 온도(ON道)

강원의 **자연·휴양** 매력은 살리고, **교통·접근·인프라** 공백은 거점 동선과 KTO 데이터로 메우는 AI 여행 플래너.

**배포:** https://evan-kim-dev.github.io/potato/

## 컨셉

| 강원의 강점 | 현실의 공백 | 온도의 해법 |
|-------------|-------------|-------------|
| 바다·산·온천·휴양 | 환승·대중교통·외진 인프라 | 출발→거점→명소 동선 + 접근 가이드 |
| 숨은 명소·상생 지역 | 발길이 닿기 어려움 | 1안 휴양 집중 / 2안 접근·상생 경유 |

## 폴더 구조

```
frontend/     # GitHub Pages 정적 앱 (브라우저)
backend/      # 데이터·동기화 스크립트·Supabase Edge
  data/       # JSON SSOT
  scripts/    # TourAPI sync · data.js 생성
  supabase/   # Edge Functions (kakao-directions)
```

## 배포 방식

코드 변경 → `main`에 **commit & push** → GitHub Actions `Deploy GitHub Pages`가 자동 배포.

| Secret (Repository) | 용도 |
|---------------------|------|
| `KAKAO_JS_KEY` | 카카오 지도 SDK |
| `KAKAO_REST_KEY` | Kakao Directions API |
| `GOOGLE_API_KEY` | Gemini |
| `TOUR_API_SERVICE_KEY` | KTO TourAPI 동기화 (CI) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | 커뮤니티·찜 (선택) |

로컬 `config.js` / `.env` / `http.server`는 **사용하지 않습니다.**

## CI 파이프라인

1. `backend/scripts/sync_tour_all.py` (Secret 있을 때) 또는 `sync_content.py generate`
2. `sync_content.py --check` — `frontend/data.js` 일치 검증
3. Secret → `frontend/config.js` 생성
4. `frontend/` → GitHub Pages

## 데이터 SSOT

| 경로 | 내용 |
|------|------|
| `backend/data/spots.json`, `catalog.json` | UI·장소 메타 |
| `backend/data/prompts.json` | Gemini 프롬프트·라우팅 (`TOUR_PROMPTS`) |
| `backend/data/tour_*.json` | TourAPI fetch 결과 |
| `frontend/app.js` | 프론트 (AI·Kakao 라우팅·UI) |

```bash
python backend/scripts/sync_content.py generate   # backend/data → frontend/data.js
```

## 아키텍처

| 레이어 | 경로 |
|--------|------|
| 프론트 | `frontend/app.js`, `frontend/data.js` |
| 프롬프트 SSOT | `backend/data/prompts.json` |
| KTO 집계 | `backend/kto_aggregation_service.py` |
| TourAPI | `backend/tour_api.py`, `backend/scripts/sync_tour_parallel_fetch.py` |
| Edge | `backend/supabase/functions/kakao-directions` |

상세: `backend/docs/TOUR_API.md`

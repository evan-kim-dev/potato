# 샤이한 열정 감자들 · 강원 온도(ON道)

강원도 여행 AI 플래너 + KTO 6-API 데이터 + 카카오맵 동선

**배포 (유일한 런타임):** https://evan-kim-dev.github.io/potato/

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

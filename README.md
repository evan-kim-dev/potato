# 샤이한 열정 감자들 · 강원 온도(ON道)

강원 **인구감소·내륙 소외 권역** 특화 AI 로컬 관광 큐레이션.

**주력 앱:** `web/` (Next.js)

## 구조

```
web/       # Next.js UI + API Routes  ← 여기만 손보면 됨
backend/   # data/*.json SSOT + TourAPI sync
.github/   # ci.yml · sync-data.yml
```

### 이름 규칙

| 영역 | 규칙 | 예 |
|------|------|----|
| 컴포넌트 | PascalCase · `*Board` | `SpotsBoard`, `ForecastBoard` |
| lib | camelCase | `tripPlan.ts`, `forecastMsg.ts` |
| API | 짧은 kebab | `/api/forecast`, `/api/plan` |
| backend | snake_case | `sync_forecast_msg.py`, `forecast_msg.json` |
## 로컬 실행

```powershell
cd web
copy .env.example .env.local
npm install
npm run dev
```

http://localhost:3000

환경 변수는 `web/.env.example` 참고. 키 없이도 로컬 코스·날씨·지도 폴백은 동작합니다.

## 데이터 (SSOT)

| 경로 | 역할 |
|------|------|
| `backend/data/*.json` | 스팟·축제·날씨 stub · Tour 집계 |
| `web/src/lib/data.ts` | 위 JSON을 읽어 API/페이지에 제공 |

갱신:

```powershell
python backend/scripts/sync_tour_all.py   # 키 필요
python backend/scripts/sync_content.py check
```

## API (`web`)

| Route | 역할 |
|-------|------|
| `POST /api/chat` | Gemini + 스팟 컨텍스트 |
| `POST /api/plan` | 로컬 코스 + AI 소개 |
| `GET /api/weather` | Open-Meteo 시·군 |
| `GET /api/beaches` | 해수욕장 기온 |
| `GET /api/forecast` | 단기예보 통보문 |
| `POST /api/directions` | 카카오/OSRM 경로 |

## CI

- `CI` — `web` typecheck + SSOT JSON 검증
- `Sync TourAPI data` — 주간/수동으로 `backend/data` 갱신 후 커밋

## 브랜치

간단 운용: `main`에 머지. 큰 작업만 `feature/...` 후 PR.

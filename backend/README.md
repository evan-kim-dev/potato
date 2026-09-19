# backend

데이터 SSOT, TourAPI 동기화, Supabase Edge Functions.

| 경로 | 역할 |
|------|------|
| `data/` | JSON 원본 (spots, catalog, prompts, tour_*) |
| `scripts/` | sync / generate |
| `tour_api.py` | KTO TourAPI 클라이언트 |
| `beach_weather_api.py` | 기상청 해수욕장 날씨 클라이언트 |
| `fcst_msg_api.py` | 기상청 단기예보 통보문 클라이언트 |
| `kto_aggregation_service.py` | 6-API 집계 |
| `supabase/` | `kakao-directions` Edge Function |
| `docs/TOUR_API.md` | TourAPI·해수욕장·통보문 연동 가이드 |

```bash
pip install -r backend/requirements.txt
python backend/scripts/sync_tour_all.py
python backend/scripts/sync_content.py generate
```

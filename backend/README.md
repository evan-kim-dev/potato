# backend

데이터 SSOT + TourAPI/기상 동기화.

| 경로 | 역할 |
|------|------|
| `data/` | JSON SSOT (`web`이 직접 읽음) |
| `scripts/` | sync / check |
| `tour_api.py` | KTO TourAPI 클라이언트 |
| `beach_weather_api.py` | 해수욕장 날씨 |
| `forecast_msg_api.py` | 단기예보 통보문 |
| `kto_aggregation_service.py` | Tour 집계 |
| `docs/` | TOUR_API · PROPOSAL |

```bash
pip install -r backend/requirements.txt
python backend/scripts/sync_tour_all.py
python backend/scripts/sync_komsco_payments.py   # KOMSCO_PAYMENT_KEY 필요
python backend/scripts/sync_content.py check
```

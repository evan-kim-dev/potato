# 씻고 와서 할 일 (최소)

## 1) `web/.env.local` 키
이미 있는 것: Kakao JS/REST, Google  
**추가할 것 (하나):**

```
DATA_GO_KR_SERVICE_KEY=공공데이터포털_일반인증키
```

→ TourAPI 동기화·조폐공사 결제정보 **같은 키**입니다.  
(마이페이지 Decoding 키 권장. 서버 재시작 후 `/impact` 확인)

## 2) (선택) 오프라인 캐시
```powershell
$env:DATA_GO_KR_SERVICE_KEY="키"
python backend/scripts/sync_tour_all.py
python backend/scripts/sync_komsco_payments.py
```

## 참고
- 결제정보 API = 시·군 **결제액·건수** (가맹점 핀 아님)
- 가맹점 POI는 `통합 가맹점기본정보` 별도 신청

# TourAPI 연동 가이드 (강원 온도)

공공데이터포털에서 **동일 인증키**로 아래 API를 각각 활용신청하세요.

| API | 매뉴얼 | 용도 |
|-----|--------|------|
| 관광빅데이터 정보서비스_GW | `TourAPI_Guide_(관광빅데이터)v4.1` | 시·군 **방문자 통계** |
| 기초지자체 중심 관광지 정보서비스_GW | `TourAPI_Guide_(중심관광지)v4.1` | 시·군 **중심 관광지** 순위 |
| **관광지별 연관관광지 정보서비스_GW** | `TourAPI_Guide_(연관관광지)v4.1` | 기준 관광지 **연관 관광지** (함께 방문) |
| 관광사진갤러리 서비스_GW | `TourAPI_Guide_(관광사진)v4.2` | 지역 **관광 사진** |
| 생태관광 정보서비스_GW | `TourAPI_Guide_(생태관광)v4.2` | 시·군 **생태관광** 명소 |
| 국문 관광정보 서비스_GW | `한국관광공사_개방데이터_활용매뉴얼(국문)_v4.4` | **공식 관광지**·**축제** |
| **관광지 집중률 방문자 추이 예측** | `TatsCnctrRateService` | 향후 30일 **혼잡·집중률** |
| **지역별 관광 수요 강도** | `AreaTarDemDsService` | 체류·수요 **강도** |
| **지역별 관광 다양성** | `AreaTarDivService` | 관광객·국제 **다양성** |
| **지역별 관광 자원 수요** | `AreaTarResDemService` | 서비스·자원 **수요** |
| *(제안서 추가 후보)* 무장애 여행 | OpenAPI | 배리어프리 코스 |
| *(제안서 추가 후보)* 두루누비 | OpenAPI | 트레킹·걷기 코스 |
| **기상청_전국 해수욕장 날씨 조회서비스** | `BeachInfoservice` | 동해안 **해수욕장** 초단기·단기·조석·일출일몰 |

시·군구 코드: `한국관광공사_TourAPI_관광지_시군구_코드정보_v1.0.xlsx` → `backend/data/gangwon_sigungu_codes.json`  
국문·생태 API용 **법정동·생태 시군구 코드**는 `sync_tour_ldong.py`가 API에서 조회해 같은 JSON에 병합합니다.

## 환경 변수

TourAPI 키는 **GitHub Actions Secret** `TOUR_API_SERVICE_KEY`로만 설정합니다. 로컬 `.env`는 사용하지 않습니다.

해수욕장 날씨는 같은 공공데이터포털 키로 **기상청_전국 해수욕장 날씨 조회서비스**를 활용신청하면 됩니다.  
선택적으로 `KMA_BEACH_SERVICE_KEY`를 넣을 수 있고, 없으면 `TOUR_API_SERVICE_KEY`를 재사용합니다.

신청: https://www.data.go.kr/data/15102239/openapi.do

## 한 번에 동기화

```bash
python backend/scripts/sync_tour_all.py
python backend/scripts/sync_content.py generate       # frontend/data.js 반영
```

해수욕장만:

```bash
python backend/scripts/sync_beach_weather.py
```

> **Note:** 개별 API 스크립트(`sync_tour_hub.py` 등)는 제거되었습니다. 부분 재동기화가 필요하면 `sync_tour_parallel_fetch.py`를 참고하거나 `sync_tour_ldong.py`만 단독 실행하세요.

법정동·생태 시군구 코드만 보강:

```bash
python backend/scripts/sync_tour_ldong.py
```

엑셀에서 시군구 코드 재가져오기:

```bash
pip install openpyxl
python backend/scripts/import_sigungu_codes.py
```

## 생성되는 데이터

| 파일 | API | UI 반영 |
|------|-----|---------|
| `backend/data/tour_visitor_stats.json` | DataLab `locgoRegnVisitrDDList` | 지도 툴팁 **방문** |
| `backend/data/tour_hub_spots.json` | `LocgoHubTarService1/areaBasedList1` | 지도 툴팁 **중심 관광지** |
| `backend/data/tour_relate_spots.json` | `TarRlteTarService1/areaBasedList1` | 툴팁·AI **연관 관광지** (기준→연관) |
| `backend/data/tour_region_photos.json` | `PhotoGalleryService1/gallerySearchList1` | 툴팁 사진·관광지 카드 썸네일 |
| `backend/data/tour_kor_spots.json` | `KorService2/areaBasedList2` | 툴팁 **공식 관광지**·카드 썸네일 |
| `backend/data/tour_kor_festivals.json` | `KorService2/searchFestival2` | 축제 탭·지역 툴팁 |
| `backend/data/tour_eco_spots.json` | `GreenTourService1/areaBasedList1` | 지도 툴팁 **생태관광** |
| `backend/data/tour_regional_insights.json` | 집중률+수요+다양성+자원+방문 매시업 | 지도 **혼잡·한산**·2안 분산 |
| `backend/data/gangwon_beaches.json` | 날씨누리 `dataCode`(=`beach_num`) | 동해안 해수욕장 카탈로그 |
| `backend/data/tour_beach_weather.json` | `BeachInfoservice` 초단기·단기·조석·일출 | 날씨 탭 **동해안 해수욕장** |
| `backend/data/gangwon_sigungu_codes.json` | 엑셀 + `ldongCode2` + `areaCode1` | API 요청용 코드 |

## API 상세

### 생태관광 `areaBasedList1`

```
GET http://apis.data.go.kr/B551011/GreenTourService1/areaBasedList1
  ?serviceKey=...&areaCode=32&sigunguCode=1
  &numOfRows=10&pageNo=1&MobileOS=ETC&MobileApp=GangwonOndo&_type=json
```

- 강원 `areaCode=32` (GreenTour 전용 지역코드, Hub API의 51과 다름)
- `sigunguCode`는 `areaCode1?areaCode=32`로 조회

응답: `title`, `summary`, `mainimage`, `addr`, `tel`, `contentId` …

### 국문 관광지 `areaBasedList2`

```
GET http://apis.data.go.kr/B551011/KorService2/areaBasedList2
  ?serviceKey=...&lDongRegnCd=51&lDongSignguCd=110&contentTypeId=12
  &arrange=O&numOfRows=10&pageNo=1&MobileOS=ETC&MobileApp=GangwonOndo&_type=json
```

- `lDongRegnCd` / `lDongSignguCd`: `ldongCode2` 법정동 코드 (Hub `areaCd`와 별도)

### 국문 축제 `searchFestival2`

```
GET http://apis.data.go.kr/B551011/KorService2/searchFestival2
  ?serviceKey=...&lDongRegnCd=51&lDongSignguCd=820
  &eventStartDate=20260101&eventEndDate=20261231&arrange=O&_type=json
```

### 중심관광지 `areaBasedList1`

```
GET http://apis.data.go.kr/B551011/LocgoHubTarService1/areaBasedList1
  ?serviceKey=...&baseYm=202504&areaCd=51&signguCd=51150
  &numOfRows=10&pageNo=1&MobileOS=ETC&MobileApp=GangwonOndo&_type=json
```

응답: `hubTatsNm`, `hubRank`, `hubCtgryMclsNm`, `mapX`, `mapY` …

### 연관관광지 `areaBasedList1`

```
GET http://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1
  ?serviceKey=...&baseYm=202504&areaCd=51&signguCd=51150
  &numOfRows=10&pageNo=1&MobileOS=ETC&MobileApp=GangwonOndo&_type=json
```

- 중심관광지 API와 동일하게 `baseYm`, `areaCd`, `signguCd` 사용
- 기준 관광지(`baseTatsNm`) 방문 시 함께 가기 좋은 **연관 관광지**(`rlteTatsNm`) 순위
- 공공데이터포털에서 **「관광지별 연관관광지 정보서비스_GW」** 별도 활용신청 필요 (미신청 시 HTTP 403)

응답: `baseTatsCd`, `baseTatsNm`, `rlteTatsCd`, `rlteTatsNm`, `rlteRank`, `rlteCtgryMclsNm`, `rlteSignguNm` …

키워드 검색:

```
GET http://apis.data.go.kr/B551011/TarRlteTarService1/searchKeyword1
  ?serviceKey=...&keyword=치악산&numOfRows=10&pageNo=1&MobileOS=ETC&MobileApp=GangwonOndo&_type=json
```

### 관광사진 `gallerySearchList1`

```
GET http://apis.data.go.kr/B551011/PhotoGalleryService1/gallerySearchList1
  ?serviceKey=...&keyword=강원+강릉시+관광&arrange=C
  &numOfRows=2&pageNo=1&MobileOS=ETC&MobileApp=GangwonOndo&_type=json
```

응답: `galTitle`, `galWebImageUrl`, `galPhotographyLocation` …

## GitHub Pages

Repository Secret `TOUR_API_SERVICE_KEY` 설정 시 배포 workflow가 자동 동기화합니다.

### 카카오 길찾기 (CORS)

브라우저에서 Kakao Mobility Directions API는 CORS가 막혀 있어 Supabase Edge Function 프록시를 사용합니다.

```
supabase secrets set KAKAO_REST_KEY=<REST_API_키>
supabase functions deploy kakao-directions --no-verify-jwt
```

프록시 실패 시 OSRM(도로 추정)으로 폴백합니다.

## 보안

인증키는 브라우저에 노출하지 마세요. CI(GitHub Actions)에서만 사용합니다.

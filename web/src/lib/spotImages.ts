/**

 * Curated TourAPI / VisitKorea image URLs for curated spots.

 * Prefer exact landmark matches; avoid region-default reuse.

 * CDN VIEW urls are used when tong.cms paths are missing/wrong in hub data.

 */

export const SPOT_IMAGE_OVERRIDES: Record<string, string> = {

  "방태산 자연휴양림 숲길":

    "https://tong.visitkorea.or.kr/cms/resource/35/3426835_image2_1.jpg",

  // 만항재 인근 고원(금대봉) — 정선 아우라지(4073387) 폴백 방지

  "만항재 은하수 전망지":

    "https://tong.visitkorea.or.kr/cms/resource/77/3525477_image2_1.jpg",

  "삼척 덕풍계곡 비경길":

    "https://tong.visitkorea.or.kr/cms/resource/12/3394112_image2_1.JPG",

  "영월 청령포 고요 산책":

    "https://tong.visitkorea.or.kr/cms/resource_photo/48/4073248_image2_1.jpg",

  "평창 백룡동굴 탐방":

    "https://tong.visitkorea.or.kr/cms/resource/90/3585090_image2_1.jpg",

  "양구 파로호 둘레길":

    "https://tong.visitkorea.or.kr/cms2/website/68/3513168.jpg",

  "속초 설악산 국립공원":

    "https://tong.visitkorea.or.kr/cms/resource_photo/47/4062547_image2_1.jpg",

  "강릉 경포대·해변":

    "https://tong.visitkorea.or.kr/cms/resource/52/3501452_image2_1.jpg",

  "강릉 안목해변 커피거리":

    "https://tong.visitkorea.or.kr/cms2/website/58/2775758.jpg",

  // 남이섬 공식 메타세쿼이아 길 (소양강/강촌 이미지와 분리)

  "춘천 남이섬":

    "https://tong.visitkorea.or.kr/cms/resource/70/2767870_image2_1.jpg",

  "춘천 소양강 스카이워크":

    "https://tong.visitkorea.or.kr/cms2/website/51/2802451.jpg",

  "원주 치악산 케이블카":

    "https://tong.visitkorea.or.kr/cms/resource/72/3388672_image2_1.JPG",

  뮤지엄산: "https://tong.visitkorea.or.kr/cms/resource_photo/01/2765601_image2_1.jpg",

  "홍천 비내섭계곡":

    "https://tong.visitkorea.or.kr/cms/resource/50/3494150_image2_1.jpg",

  "태백산 천제단":

    "https://tong.visitkorea.or.kr/cms/resource/56/4057456_image2_1.jpg",

  "정선 레일바이크":

    "https://tong.visitkorea.or.kr/cms/resource/30/3533330_image2_1.jpg",

  "정선 하이원 리조트 전망":

    "https://tong.visitkorea.or.kr/cms/resource/97/4061397_image2_1.jpg",

  "동해 무릉계곡":

    "https://tong.visitkorea.or.kr/cms/resource/61/3344961_image2_1.jpg",

  "동해 무릉 건강숲":

    "https://tong.visitkorea.or.kr/cms/resource/98/3569498_image2_1.jpg",

  "삼척 케이블카·용화해수욕장":

    "https://tong.visitkorea.or.kr/cms/resource/23/3517423_image2_1.jpg",

  "고성 통일전망대":

    "https://tong.visitkorea.or.kr/cms/resource/93/3515893_image2_1.jpg",

  "양양 서피비치":

    "https://tong.visitkorea.or.kr/cms/resource/60/3518260_image2_1.jpg",

  // hub 데이터가 설악산(4062547)을 잘못 붙인 케이스 → 열린관광 공식 사진

  "인제 원대리 자작나무숲":

    "https://cdn.visitkorea.or.kr/img/call?cmd=VIEW&id=0fc052c8-db6d-45f9-b564-275d45da0abb",

  "횡성 한우·둔내 온천":

    "https://tong.visitkorea.or.kr/cms/resource/32/3457832_image2_1.png",

  "화천 산천어축제 거리":

    "https://tong.visitkorea.or.kr/cms2/website/09/3554509.JPG",

  고석정국민관광지:

    "https://tong.visitkorea.or.kr/cms/resource/12/3331512_image2_1.jpg",

};

/** Extra search tokens when spot name ≠ TourAPI title */

export const SPOT_IMAGE_ALIASES: Record<string, string[]> = {

  "만항재 은하수 전망지": ["만항재", "금대봉", "함백산"],

  "방태산 자연휴양림 숲길": ["방태산"],

  "영월 청령포 고요 산책": ["청령포"],

  "양구 파로호 둘레길": ["파로호"],

  "속초 설악산 국립공원": ["설악산"],

  "강릉 경포대·해변": ["경포대", "경포해변"],

  "강릉 안목해변 커피거리": ["안목해변", "안목"],

  "춘천 남이섬": ["남이섬", "나미섬"],

  "춘천 소양강 스카이워크": ["소양강스카이워크", "소양강"],

  뮤지엄산: ["뮤지엄산"],

  "정선 하이원 리조트 전망": ["하이원리조트", "하이원"],

  "정선 레일바이크": ["정선레일바이크", "레일바이크"],

  "인제 원대리 자작나무숲": ["속삭이는자작나무숲", "자작나무숲", "원대리"],

  고석정국민관광지: ["고석정"],

  "태백산 천제단": ["천제단", "태백산", "검룡소"],

  "동해 무릉계곡": ["무릉계곡", "무릉"],

  "양양 서피비치": ["서피비치"],

  "고성 통일전망대": ["통일전망대", "통일전망"],

};


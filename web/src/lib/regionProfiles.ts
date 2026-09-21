export type RegionProfile = {
  /** 강원관광(gangwon.to)식 짧은 헤드라인 */
  headline: string;
  tagline: string;
  pop: string;
  specialty: string;
  highlight: string;
  /** 공식 관광 포털 시·군 소개 연계 */
  officialUrl: string;
};

/**
 * 시·군 소개 — 강원관광(https://gangwon.to/gwtour) 카피를 기준으로 정리.
 * 인구·특산·하이라이트는 서비스 큐레이션용 보강.
 */
export const REGION_PROFILES: Record<string, RegionProfile> = {
  춘천시: {
    headline: "낭만이 흐르는 호반의 도시",
    tagline:
      "맑은 호수와 푸른 산이 어우러진 감성 여행지. 남이섬·소양강·공지천에서 사계절 이야기를 시작하세요.",
    pop: "약 28.2만",
    specialty: "막국수·닭갈비·닭강정",
    highlight: "남이섬·소양강·공지천",
    officialUrl: "https://www.gangwon.to/gwtour",
  },
  원주시: {
    headline: "문화와 자연이 숨 쉬는 도시",
    tagline:
      "치악산의 품에 안긴 힐링 여행지. 뮤지엄산·간현·소금산 출렁다리 등 자연과 문화예술이 함께합니다.",
    pop: "약 35.1만",
    specialty: "치악산 떡·한우·문화예술",
    highlight: "치악산·뮤지엄산·소금산",
    officialUrl: "https://www.gangwon.to/gwtour",
  },
  강릉시: {
    headline: "바다와 문화가 만나는 도시",
    tagline:
      "전통과 예술이 살아 숨 쉬는 고장. 사계절 매력적이지만, 혼잡할 땐 인근 한산 권역으로 분산을 권합니다.",
    pop: "약 21.3만",
    specialty: "커피·초당순두부·오징어순대",
    highlight: "경포·안목·주문진",
    officialUrl: "https://www.gangwon.to/gwtour",
  },
  동해시: {
    headline: "바다와 산이 빚어낸 감동의 도시",
    tagline:
      "해양레저·힐링·역사 체험이 어우러진 사계절 관광도시. 추암·망상과 함께 내륙 분산 코스를 살펴보세요.",
    pop: "약 9.1만",
    specialty: "묵호회·맥주·멸치",
    highlight: "추암·망상·논골담길",
    officialUrl: "https://www.gangwon.to/gwtour",
  },
  태백시: {
    headline: "하늘에 가장 가까운 도시",
    tagline:
      "해발 1,000m 고원. 설경·한여름 피서·광산 문화가 살아 있는 인구감소 권역의 숨은 감동을 만나보세요.",
    pop: "약 4.2만",
    specialty: "황기·마늘·탄광 문화",
    highlight: "태백산·황지연못·탄광박물관",
    officialUrl: "https://www.gangwon.to/gwtour",
  },
  속초시: {
    headline: "바다와 산, 추억이 머무는 곳",
    tagline:
      "동해와 설악이 한곳에. 핫플 혼잡 시에는 인제·양구·고성 등 인접 한산 권역으로 이어가 보세요.",
    pop: "약 8.4만",
    specialty: "오징어·닭강정·홍게",
    highlight: "설악산·아바이·영금정",
    officialUrl: "https://www.gangwon.to/gwtour",
  },
  삼척시: {
    headline: "숨겨진 자연의 보석",
    tagline:
      "에메랄드 동해와 대금굴·해안 절경. 일상에서 벗어난 힐링과 함께 태백·정선으로의 분산도 좋아요.",
    pop: "약 6.5만",
    specialty: "대게·오징어·동굴 관광",
    highlight: "환선굴·장호·해안",
    officialUrl: "https://www.gangwon.to/gwtour",
  },
  홍천군: {
    headline: "자연이 주는 선물",
    tagline:
      "맑은 공기와 강·숲이 어우러진 힐링 여행지. 래프팅·산책·캠핑 등 가족형 체험이 풍부한 내륙 연계 권역입니다.",
    pop: "약 7.0만",
    specialty: "감·송어·온천",
    highlight: "팔봉산·비발디·수타사",
    officialUrl: "https://www.gangwon.to/gwtour",
  },
  횡성군: {
    headline: "건강한 쉼이 있는 곳",
    tagline:
      "횡성한우와 향토 미식, 치악산 자락 절경·숲길·온천이 있는 깊이 있는 내륙 여행지입니다.",
    pop: "약 4.6만",
    specialty: "횡성한우·송이·잣",
    highlight: "둔내·횡성한우·안흥",
    officialUrl: "https://www.gangwon.to/gwtour",
  },
  영월군: {
    headline: "역사가 흐르고 자연이 숨 쉬는 곳",
    tagline:
      "동강과 태백산맥이 감싸는 문화·생태 관광도시. 청령포·장릉·별마로천문대 등 한산 권역 대표 코스입니다.",
    pop: "약 3.7만",
    specialty: "와인·메밀·단종 유적",
    highlight: "동강·청령포·별마로",
    officialUrl: "https://www.gangwon.to/gwtour",
  },
  평창군: {
    headline: "자연·문화·스포츠가 어우러진 고원",
    tagline:
      "대관령 양떼목장·오대산·이효석 문학관 등. 사계절 고원 힐링과 내륙 연계 분산에 좋은 권역입니다.",
    pop: "약 4.3만",
    specialty: "송어·한우·감자",
    highlight: "대관령·오대산·월정사",
    officialUrl: "https://www.gangwon.to/gwtour",
  },
  정선군: {
    headline: "아리랑과 함께 걷는 자연의 길",
    tagline:
      "산·강·전통이 어우러진 진짜 강원. 아리랑열차·레일바이크·병방치·가리왕산으로 저밀도 여행을 이어가세요.",
    pop: "약 3.5만",
    specialty: "곤드레밥·아리랑·사과",
    highlight: "레일바이크·병방치·화암동굴",
    officialUrl: "https://www.gangwon.to/gwtour",
  },
  철원군: {
    headline: "평화의 길을 걷는 여행",
    tagline:
      "DMZ 너머 감동. 자연·역사·평화가 함께하는 인구감소 권역에서 생태와 안보 여행을 시작해 보세요.",
    pop: "약 4.8만",
    specialty: "오디·한탄강 메기·평야 쌀",
    highlight: "한탄강·고석정·평화레일",
    officialUrl: "https://www.gangwon.to/gwtour",
  },
  화천군: {
    headline: "사계절 힐링도시",
    tagline:
      "자연과 겨울, 평화가 만나는 곳. 느긋한 쉼과 산천어·파로호 등 한산한 체류형 여행에 어울립니다.",
    pop: "약 2.6만",
    specialty: "산천어·콩·DMZ 생태",
    highlight: "산천어축제·파로호·DMZ",
    officialUrl: "https://www.gangwon.to/gwtour",
  },
  양구군: {
    headline: "고요한 자연의 속삭임",
    tagline:
      "한반도 중심의 순수 자연. 산세·계곡·DMZ 생태가 어우러진 작지만 깊이 있는 감동의 한산 권역입니다.",
    pop: "약 2.4만",
    specialty: "한우·오디·DMZ 체험",
    highlight: "파로호·투타연·펀치볼",
    officialUrl: "https://www.gangwon.to/gwtour",
  },
  인제군: {
    headline: "자연이 빚은 청정 여행지",
    tagline:
      "설악과 내린천이 품은 쉼과 모험. 백담사·방태산·자작나무숲 등 저밀도 힐링 코스의 중심입니다.",
    pop: "약 3.2만",
    specialty: "메밀·버섯·산나물",
    highlight: "원대리·방태산·백담사",
    officialUrl: "https://www.gangwon.to/gwtour",
  },
  고성군: {
    headline: "평화와 자연이 살아 숨 쉬는 곳",
    tagline:
      "마음이 쉬어가는 평화의 길. 해안·DMZ·설악 북쪽 관문으로서 한산한 체류를 권합니다.",
    pop: "약 2.7만",
    specialty: "수산물·잣·DMZ 기념품",
    highlight: "화진포·해안·천학정",
    officialUrl: "https://www.gangwon.to/gwtour",
  },
  양양군: {
    headline: "양양의 품에서 여유를 찾다",
    tagline:
      "서핑·트레킹·캠핑과 맑은 공기. 해안 피서 뒤에는 인제·고성 등 인접 한산 권역으로 이어가 보세요.",
    pop: "약 2.7만",
    specialty: "송이·송어·서핑",
    highlight: "낙산·하조대·죽도",
    officialUrl: "https://www.gangwon.to/gwtour",
  },
};

export function regionProfile(region: string): RegionProfile {
  return (
    REGION_PROFILES[region] || {
      headline: "강원의 매력 있는 여행지",
      tagline: "강원관광 공식 소개를 참고해 맞춤 코스를 짜 보세요.",
      pop: "—",
      specialty: "지역 먹거리·자연",
      highlight: "AI 맞춤 코스 추천",
      officialUrl: "https://www.gangwon.to/gwtour",
    }
  );
}

export function regionShortName(region: string) {
  return region.replace(/(시|군)$/, "");
}

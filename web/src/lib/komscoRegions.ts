/** 강원특별자치도 시·군 ↔ 법정동코드 앞 5자리 (조폐공사 USAGE_RGN_CD)
 *  구 강원도 42xxx → 특별자치도 51xxx
 */
export const GANGWON_RGN_CODES: Record<string, string> = {
  춘천시: "51110",
  원주시: "51130",
  강릉시: "51150",
  동해시: "51170",
  태백시: "51190",
  속초시: "51210",
  삼척시: "51230",
  홍천군: "51720",
  횡성군: "51730",
  영월군: "51750",
  평창군: "51760",
  정선군: "51770",
  철원군: "51780",
  화천군: "51790",
  양구군: "51800",
  인제군: "51810",
  고성군: "51820",
  양양군: "51830",
};

export const RGN_CODE_TO_REGION: Record<string, string> = Object.fromEntries(
  Object.entries(GANGWON_RGN_CODES).map(([region, code]) => [code, region])
);

export function regionToUsageCode(region: string): string | undefined {
  return GANGWON_RGN_CODES[region];
}

import { NextResponse } from "next/server";
import { fetchGangwonPaymentsLive } from "@/lib/komscoPayments";

export const dynamic = "force-dynamic";

/** 강원 시·군 지역사랑상품권 결제 집계 (조폐공사 paymentsV3) */
export async function GET() {
  try {
    const payload = await fetchGangwonPaymentsLive({ monthsBack: 3 });
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "fetch failed",
        regions: [],
        totalAmount: 0,
        totalCount: 0,
        quietAmount: 0,
        quietSharePct: 0,
      },
      { status: 500 }
    );
  }
}

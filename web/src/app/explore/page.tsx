import { redirect } from "next/navigation";

/** 예전 /explore 링크 호환 — 홈(지도)으로 보냄 */
export default async function ExploreRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ask = sp?.ask;
  const q =
    typeof ask === "string" && ask
      ? `?ask=${encodeURIComponent(ask)}`
      : Array.isArray(ask) && ask[0]
        ? `?ask=${encodeURIComponent(ask[0])}`
        : "";
  redirect(`/${q}`);
}

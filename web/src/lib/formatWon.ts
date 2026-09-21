/** 금액 표시 — 클라이언트 안전 (fs 없음) */
export function formatWon(n: number): string {
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}억`;
  if (n >= 1e4) return `${Math.round(n / 1e4).toLocaleString("ko-KR")}만`;
  return `${n.toLocaleString("ko-KR")}원`;
}

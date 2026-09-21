/** 강원페이 영수증 연동 목업 — 로컬 저장 (실제 결제 API 아님) */

export type PayReceipt = {
  id: string;
  merchant: string;
  region: string;
  amount: number;
  paidAt: string;
  method: "강원페이";
  note?: string;
  /** 목업: 첨부 파일명 또는 '샘플 영수증' */
  attachment: string;
  createdAt: string;
};

const KEY = "gw_pay_receipts_v1";

function read(): PayReceipt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as PayReceipt[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list: PayReceipt[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 40)));
}

export function loadPayReceipts(): PayReceipt[] {
  return read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function savePayReceipt(
  input: Omit<PayReceipt, "id" | "createdAt" | "method"> & { method?: "강원페이" }
): PayReceipt {
  const next: PayReceipt = {
    ...input,
    method: "강원페이",
    id: `rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  const list = [next, ...read()];
  write(list);
  return next;
}

export function clearPayReceipts() {
  write([]);
}

export function payReceiptTotals(list: PayReceipt[]) {
  const amount = list.reduce((n, r) => n + (r.amount || 0), 0);
  const regions = new Set(list.map((r) => r.region).filter(Boolean));
  return { amount, count: list.length, regions: regions.size };
}

/** 클라이언트 안전 — ChatSlots 타입만 (fs/data 미포함) */
export type ChatSlots = {
  startDate?: string;
  endDate?: string;
  duration?: string;
  regions?: string[];
  themes?: string[];
  companion?: string;
  budget?: string;
  origin?: string;
  destination?: string;
  /** car | walk | bicycle */
  mode?: string;
  readyForPlan?: boolean;
};

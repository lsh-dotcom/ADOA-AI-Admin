/** 원 단위 금액을 한국식 포맷으로 변환 */
export function formatKRW(amount: number | null | undefined): string {
  if (amount == null) return "₩0";
  return `₩${amount.toLocaleString("ko-KR")}`;
}

/** 날짜 문자열을 한국식 포맷으로 변환 */
export function formatDate(date: string | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** 계약 상태 한글명 매핑 */
export const CONTRACT_STATUS_MAP: Record<
  string,
  { label: string; color: string }
> = {
  draft: { label: "초안", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  sent_to_client: { label: "발송완료", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  negotiating: { label: "협의중", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  signed: { label: "체결", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  in_progress: { label: "진행중", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  delivered: { label: "납품완료", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300" },
  completed: { label: "완료", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
};

/** 결제 상태 한글명 매핑 */
export const PAYMENT_STATUS_MAP: Record<
  string,
  { label: string; color: string }
> = {
  pending: { label: "대기", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  invoiced: { label: "청구완료", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  tax_invoice_issued: { label: "세금계산서 발행", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  paid: { label: "입금확인", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  confirmed: { label: "정산완료", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
};

/** 상태 전환 가능 목록 */
export const CONTRACT_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["sent_to_client"],
  sent_to_client: ["negotiating", "signed"],
  negotiating: ["signed", "draft"],
  signed: ["in_progress"],
  in_progress: ["delivered"],
  delivered: ["completed"],
  completed: [],
};

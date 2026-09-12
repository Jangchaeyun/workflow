import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 1_250_000 → "125만원" 처럼 대시보드 카드에 들어갈 짧은 표기 */
export function formatCurrencyShort(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return '0원';
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);

  if (abs >= 1_0000_0000) return `${sign}${trimZero(abs / 1_0000_0000)}억원`;
  if (abs >= 1_0000) return `${sign}${trimZero(abs / 1_0000)}만원`;
  return `${sign}${abs.toLocaleString('ko-KR')}원`;
}

function trimZero(value: number): string {
  return Number(value.toFixed(1)).toLocaleString('ko-KR');
}

export function formatCurrency(amount: number): string {
  return `${Math.round(amount).toLocaleString('ko-KR')}원`;
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('ko-KR');
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '-';
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `<input type="date">` 의 value 로 넣을 수 있는 형식 */
export function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** 마감일까지 남은 일수. 음수면 지연. */
export function daysUntil(due: Date | string | null | undefined): number | null {
  if (!due) return null;
  const date = typeof due === 'string' ? new Date(due) : due;
  if (Number.isNaN(date.getTime())) return null;

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000);
}

export function formatDueLabel(due: Date | string | null | undefined): string {
  const diff = daysUntil(due);
  if (diff === null) return '기한 없음';
  if (diff === 0) return '오늘 마감';
  if (diff === 1) return '내일 마감';
  if (diff < 0) return `${Math.abs(diff)}일 지연`;
  return `${diff}일 남음`;
}

export function formatRelativeTime(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return formatDate(date);
}

export function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  // 한글 이름은 성을 제외한 이름 두 자가 더 구분이 잘 된다.
  return /[가-힣]/.test(trimmed) ? trimmed.slice(-2) : trimmed.slice(0, 2).toUpperCase();
}

/** 검색 쿼리스트링을 보존하면서 일부 파라미터만 갱신 */
export function buildQueryString(
  current: Record<string, string | undefined>,
  patch: Record<string, string | number | undefined | null>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null || value === '') params.delete(key);
    else params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function percent(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

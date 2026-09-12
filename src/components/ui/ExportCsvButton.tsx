import { Download } from 'lucide-react';

import { buttonClass } from '@/components/ui/Button';

interface ExportCsvButtonProps {
  type: 'tasks' | 'clients' | 'deals';
  /** 목록 페이지의 현재 필터를 그대로 넘긴다. */
  query?: Record<string, string | undefined>;
  label?: string;
}

/** CSV 다운로드 링크. 서버 컴포넌트에서도 Suspense 없이 쓸 수 있다. */
export function ExportCsvButton({ type, query = {}, label = 'CSV 내보내기' }: ExportCsvButtonProps) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  const href = `/api/export/${type}${params.toString() ? `?${params}` : ''}`;

  return (
    <a href={href} className={buttonClass('secondary', 'sm')} download>
      <Download className="size-3.5" />
      {label}
    </a>
  );
}

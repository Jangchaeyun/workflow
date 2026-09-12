import Link from 'next/link';
import { BarChart3, CheckCircle2, Users2, Workflow } from 'lucide-react';

const HIGHLIGHTS = [
  {
    icon: CheckCircle2,
    title: '업무 배정부터 완료까지',
    description: '담당자·마감일·우선순위를 지정하고 칸반 보드에서 진행 상황을 한눈에 확인합니다.',
  },
  {
    icon: Users2,
    title: '거래처와 상담 이력 관리',
    description: '거래처별 담당자와 상담 기록을 누적해 후속 조치까지 놓치지 않습니다.',
  },
  {
    icon: BarChart3,
    title: '영업 파이프라인과 매출 통계',
    description: '단계별 수주 확률로 가중 매출을 예측하고 목표 대비 실적을 추적합니다.',
  },
];

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-sidebar p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* 기하 패턴 — 블러 글로우 대신 선명한 격자·도형으로 분위기를 만든다. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'linear-gradient(rgb(255 255 255 / 0.08) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.08) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -top-10 right-8 size-44 rotate-12 rounded-3xl border border-white/15"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-24 -left-8 size-56 -rotate-6 rounded-full border border-brand/40"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute right-16 bottom-16 size-24 rounded-2xl bg-brand/30"
          aria-hidden
        />

        <Link href="/" className="relative inline-flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand text-white">
            <Workflow className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">WorkFlow</span>
        </Link>

        <div className="relative max-w-md space-y-10">
          <div className="space-y-4">
            <p className="text-xs font-semibold tracking-[0.16em] text-brand uppercase">
              Business OS
            </p>
            <h1 className="font-display text-3xl leading-snug font-semibold tracking-tight">
              흩어진 업무와 영업 정보를
              <br />
              하나의 시스템으로
            </h1>
            <p className="text-sm leading-relaxed text-sidebar-ink/80">
              중소기업의 업무 배정, 거래처 관리, 영업 파이프라인을 통합한 사내 업무관리 시스템입니다.
            </p>
          </div>

          <ul className="space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-3.5">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-sidebar-line bg-sidebar-muted">
                  <Icon className="size-4 text-brand" />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs leading-relaxed text-sidebar-faint">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-sidebar-faint">
          WorkFlow · 포트폴리오 목적으로 제작된 데모 시스템
        </p>
      </aside>

      <main className="relative flex items-center justify-center bg-canvas px-6 py-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 70% 50% at 80% 10%, rgb(15 118 110 / 0.08), transparent 55%)',
          }}
          aria-hidden
        />
        <div className="relative w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}

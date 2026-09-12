import type { Metadata } from 'next';
import { Noto_Sans_KR, Outfit } from 'next/font/google';
import './globals.css';

const notoSansKr = Noto_Sans_KR({
  variable: '--font-noto-sans-kr',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
});

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'WorkFlow — 중소기업 업무·영업 관리 시스템',
    template: '%s · WorkFlow',
  },
  description:
    '업무 배정부터 거래처 상담, 영업 파이프라인과 매출 통계까지 한 곳에서 관리하는 중소기업용 업무관리 시스템',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} ${outfit.variable} h-full`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}

import { redirect } from 'next/navigation';

export default function RootPage() {
  // 인증 여부는 proxy 에서 이미 판정되므로 여기서는 기본 진입 화면으로만 넘긴다.
  redirect('/dashboard');
}

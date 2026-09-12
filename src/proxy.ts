import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

const PUBLIC_PATHS = ['/login', '/signup'];

/**
 * 1차 인증 경계 (Next.js 16 의 proxy 컨벤션).
 *
 * 여기서는 "로그인 여부"만 판정한다. 세분화된 권한 검사는 DB의 권한 매트릭스를 읽어야 하므로
 * 각 페이지·서버 액션의 `requirePermission()` / `assertPermission()` 에서 처리한다.
 * 즉 프록시는 UX(로그인 화면으로 보내기)를 담당하고, 실제 인가는 데이터 접근 지점에서 강제한다.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (isPublic) return NextResponse.next();

    const loginUrl = new URL('/login', request.url);
    // 로그인 후 원래 가려던 화면으로 되돌려 보낸다.
    if (pathname !== '/') loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (isPublic) return NextResponse.redirect(new URL('/dashboard', request.url));

  // 만료된 쿠키가 남아있을 때 응답 헤더로 정리할 수 있도록 사용자 정보를 실어 보낸다.
  const response = NextResponse.next();
  response.headers.set('x-workflow-user', session.sub);
  return response;
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/signup',
    '/dashboard/:path*',
    '/today/:path*',
    '/settings/:path*',
    '/tasks/:path*',
    '/clients/:path*',
    '/sales/:path*',
    '/admin/:path*',
    '/notifications/:path*',
    '/forbidden',
  ],
};

import { SignJWT, jwtVerify } from 'jose';
import type { Role } from './constants';

export const SESSION_COOKIE = 'workflow_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 근무 시간 기준 8시간

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  role: Role;
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // 로컬 실행 편의를 위한 폴백. 운영 배포 시에는 반드시 AUTH_SECRET 을 주입해야 한다.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET 환경 변수가 설정되지 않았습니다.');
    }
    return new TextEncoder().encode('workflow-local-development-secret-key');
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.sub !== 'string' || typeof payload.role !== 'string') return null;

    return {
      sub: payload.sub,
      email: String(payload.email ?? ''),
      name: String(payload.name ?? ''),
      role: payload.role as Role,
    };
  } catch {
    // 만료 · 위조 · 서명 불일치는 모두 "비로그인"으로 동일하게 취급한다.
    return null;
  }
}

export const sessionCookieOptions = {
  name: SESSION_COOKIE,
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_MAX_AGE_SECONDS,
};

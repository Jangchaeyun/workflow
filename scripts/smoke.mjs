/**
 * 역할별로 세션을 만들어 주요 화면의 응답 코드를 훑어보는 스모크 테스트.
 *
 * 사용법: node scripts/smoke.mjs [baseUrl]
 * 개발 서버가 떠 있는 상태에서 실행한다.
 */
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import { readFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:3000';

// .env 를 직접 읽어 서버와 같은 서명 키를 쓴다.
const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const secret = new TextEncoder().encode(
  env.match(/^AUTH_SECRET="?([^"\r\n]*)"?/m)?.[1] || 'workflow-local-development-secret-key',
);

/** 각 역할이 접근할 수 있어야 하는 화면과, 막혀야 하는 화면 */
const CASES = [
  {
    email: 'admin@workflow.co.kr',
    allow: [
      '/dashboard',
      '/today',
      '/settings/profile',
      '/tasks',
      '/tasks/board',
      '/clients',
      '/sales',
      '/sales?view=list',
      '/sales/reports',
      '/admin/users',
      '/admin/departments',
      '/admin/permissions',
      '/admin/logs',
    ],
    deny: [],
  },
  {
    email: 'manager.sales@workflow.co.kr',
    allow: ['/dashboard', '/tasks', '/clients', '/sales', '/sales/reports', '/admin/users'],
    deny: ['/admin/permissions', '/admin/departments'],
  },
  {
    email: 'sales1@workflow.co.kr',
    allow: ['/dashboard', '/tasks', '/clients', '/sales'],
    deny: ['/sales/reports', '/admin/users', '/admin/logs'],
  },
  {
    email: 'staff1@workflow.co.kr',
    allow: ['/dashboard', '/tasks', '/tasks/board', '/clients'],
    deny: ['/sales', '/sales/reports', '/admin/users'],
  },
];

const prisma = new PrismaClient();

async function cookieFor(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`시드 계정을 찾을 수 없습니다: ${email}`);

  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret);

  return { cookie: `workflow_session=${token}`, user };
}

async function check(cookie, route) {
  const res = await fetch(`${base}${route}`, { headers: { cookie }, redirect: 'manual' });
  const location = res.headers.get('location') ?? '';
  return { status: res.status, location };
}

async function main() {
  let failed = 0;

  for (const testCase of CASES) {
    const { cookie, user } = await cookieFor(testCase.email);
    console.log(`\n── ${user.name} (${user.role}) ${testCase.email}`);

    for (const route of testCase.allow) {
      const { status, location } = await check(cookie, route);
      const ok = status === 200;
      if (!ok) failed += 1;
      console.log(`  ${ok ? '✓' : '✗'} ${status} ${route}${location ? ` → ${location}` : ''}`);
    }

    for (const route of testCase.deny) {
      const { status, location } = await check(cookie, route);
      // 권한 부족은 /forbidden 리다이렉트로 처리된다.
      const ok = location.includes('/forbidden') || status === 403;
      if (!ok) failed += 1;
      console.log(`  ${ok ? '✓ 차단' : '✗ 노출'} ${status} ${route}${location ? ` → ${location}` : ''}`);
    }
  }

  // 비로그인 접근은 로그인 화면으로 보내야 한다.
  const guest = await check('', '/dashboard');
  const guestOk = guest.location.includes('/login');
  if (!guestOk) failed += 1;
  console.log(`\n── 비로그인\n  ${guestOk ? '✓' : '✗'} ${guest.status} /dashboard → ${guest.location}`);

  console.log(failed === 0 ? '\n전부 통과' : `\n실패 ${failed}건`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('✗', error.message);
  await prisma.$disconnect();
  process.exit(1);
});

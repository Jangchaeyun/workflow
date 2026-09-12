import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getAccessScope, canViewTask } from '@/lib/scope';
import { readUpload } from '@/lib/storage';

/**
 * 첨부파일 다운로드.
 *
 * 파일은 웹 루트 밖에 저장되므로 이 핸들러가 유일한 접근 경로다.
 * 여기서 세션과 업무 열람 권한을 확인해, 링크만 알아도 내려받는 상황을 막는다.
 */
export async function GET(_request: Request, { params }: RouteContext<'/api/attachments/[id]'>) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('로그인이 필요합니다.', { status: 401 });

  const { id } = await params;

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: { task: { include: { watchers: { select: { userId: true } } } } },
  });

  if (!attachment || attachment.task.deletedAt) {
    return new NextResponse('파일을 찾을 수 없습니다.', { status: 404 });
  }

  const scope = await getAccessScope();
  if (!canViewTask(scope, attachment.task)) {
    return new NextResponse('접근 권한이 없습니다.', { status: 403 });
  }

  let file: Buffer;
  try {
    file = await readUpload(attachment.storedName);
  } catch {
    return new NextResponse('파일이 저장소에 존재하지 않습니다.', { status: 404 });
  }

  return new NextResponse(new Uint8Array(file), {
    headers: {
      'Content-Type': attachment.mimeType,
      'Content-Length': String(attachment.size),
      // 한글 파일명이 깨지지 않도록 RFC 5987 형식으로 함께 내려준다.
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      'Cache-Control': 'private, no-store',
    },
  });
}

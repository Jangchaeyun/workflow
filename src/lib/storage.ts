import 'server-only';

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * 첨부파일 저장소.
 *
 * public/ 아래에 두면 URL 만 알아도 권한 없이 내려받을 수 있으므로,
 * 웹 루트 밖(storage/uploads)에 저장하고 다운로드는 인증·인가를 거치는
 * 라우트 핸들러(`/api/attachments/[id]`)로만 제공한다.
 */
const UPLOAD_ROOT = path.join(process.cwd(), 'storage', 'uploads');

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

/** 실행 파일 등 위험한 확장자는 업로드 자체를 막는다. */
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.js', '.jar', '.sh', '.ps1', '.vbs', '.dll',
]);

export interface StoredFile {
  fileName: string;
  storedName: string;
  mimeType: string;
  size: number;
}

export function validateUpload(file: File): string | null {
  if (file.size === 0) return '빈 파일은 업로드할 수 없습니다.';
  if (file.size > MAX_UPLOAD_BYTES) return '파일 크기는 10MB 이하만 업로드할 수 있습니다.';

  const extension = path.extname(file.name).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(extension)) return `${extension} 형식은 업로드할 수 없습니다.`;

  return null;
}

export async function saveUpload(file: File): Promise<StoredFile> {
  await mkdir(UPLOAD_ROOT, { recursive: true });

  // 원본 파일명을 그대로 쓰면 경로 조작·중복 위험이 있어 UUID 로 저장하고 원본명은 DB에만 남긴다.
  const storedName = `${randomUUID()}${path.extname(file.name).toLowerCase()}`;
  await writeFile(path.join(UPLOAD_ROOT, storedName), Buffer.from(await file.arrayBuffer()));

  return {
    fileName: path.basename(file.name),
    storedName,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
  };
}

export async function readUpload(storedName: string): Promise<Buffer> {
  // 경로 이탈(../) 방지: 파일명만 취한다.
  return readFile(path.join(UPLOAD_ROOT, path.basename(storedName)));
}

export async function removeUpload(storedName: string): Promise<void> {
  await unlink(path.join(UPLOAD_ROOT, path.basename(storedName))).catch(() => undefined);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

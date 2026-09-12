import fs from 'node:fs';
import type { NextConfig } from 'next';

/**
 * exFAT/FAT 볼륨에서는 일반 파일에 readlink 를 호출하면 EINVAL 대신 EISDIR 가 돌아온다.
 * Next 의 빌드 트레이싱은 EINVAL·ENOENT·UNKNOWN 만 "심링크가 아님"으로 처리하므로
 * 프로덕션 빌드가 그대로 실패한다. 그래서 오류 코드만 표준값으로 바꿔 준다.
 *
 * NTFS 등 정상 파일시스템에서는 EISDIR 가 나오지 않으므로 아무 영향이 없다.
 */
function normalizeReadlinkErrors() {
  const toEinval = (error: unknown) => {
    const err = error as NodeJS.ErrnoException | null;
    if (err && err.code === 'EISDIR') err.code = 'EINVAL';
    return err;
  };

  type AnyFn = (...args: unknown[]) => unknown;
  const readlink = fs.readlink as unknown as AnyFn;
  const readlinkSync = fs.readlinkSync as unknown as AnyFn;
  const readlinkAsync = fs.promises.readlink as unknown as AnyFn;

  fs.readlink = ((...args: unknown[]) => {
    const callback = args.pop() as (error: unknown, link?: string) => void;
    return readlink(...args, (error: unknown, link?: string) =>
      callback(toEinval(error), link),
    );
  }) as unknown as typeof fs.readlink;

  fs.readlinkSync = ((...args: unknown[]) => {
    try {
      return readlinkSync(...args);
    } catch (error) {
      throw toEinval(error);
    }
  }) as unknown as typeof fs.readlinkSync;

  fs.promises.readlink = (async (...args: unknown[]) => {
    try {
      return await readlinkAsync(...args);
    } catch (error) {
      throw toEinval(error);
    }
  }) as unknown as typeof fs.promises.readlink;
}

normalizeReadlinkErrors();

const nextConfig: NextConfig = {
  webpack(config) {
    // 이 프로젝트는 심볼릭 링크를 쓰지 않으므로 해석 단계를 건너뛴다.
    config.resolve.symlinks = false;
    return config;
  },
};

export default nextConfig;

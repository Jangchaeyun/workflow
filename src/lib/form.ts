export interface ActionState {
  error?: string;
  success?: string;
  /** 필드별 오류가 필요한 화면에서 사용 */
  fieldErrors?: Record<string, string>;
}

export const emptyActionState: ActionState = {};

/** FormData → 평범한 객체. 파일 입력은 별도로 처리하므로 문자열 값만 남긴다. */
export function formToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') result[key] = value;
  }
  return result;
}

/** 서버 액션에서 발생한 예외를 사용자에게 보여줄 메시지로 변환 */
export function toActionError(error: unknown): ActionState {
  if (error instanceof Error) {
    // Prisma 유니크 제약 위반
    if ('code' in error && (error as { code?: string }).code === 'P2002') {
      return { error: '이미 등록된 값입니다. 중복 여부를 확인해주세요.' };
    }
    return { error: error.message };
  }
  return { error: '처리 중 오류가 발생했습니다.' };
}

import { z } from 'zod';

import {
  CLIENT_GRADES,
  CLIENT_SCALES,
  CLIENT_STATUSES,
  CONSULTATION_RESULTS,
  CONSULTATION_TYPES,
  CONTRACT_STATUSES,
  DEAL_STAGES,
  ROLES,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  USER_STATUSES,
} from './constants';

/**
 * 서버 액션 입력 스키마.
 * 클라이언트 검증은 UX 보조 수단일 뿐이므로 모든 변경은 이 스키마를 통과해야 한다.
 */

// zod 버전에 따라 문자열 포맷 헬퍼의 위치가 달라져, 이메일은 직접 검증한다.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const email = z
  .string()
  .trim()
  .min(1, '이메일을 입력해주세요.')
  .max(120)
  .refine((value) => EMAIL_PATTERN.test(value), '이메일 형식이 올바르지 않습니다.')
  .transform((value) => value.toLowerCase());

const password = z.string().min(8, '비밀번호는 8자 이상이어야 합니다.').max(72);

/** 빈 문자열로 들어오는 optional 폼 값을 null 로 정규화 */
const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional()
  .refine((value) => value === null || value === undefined || !Number.isNaN(Date.parse(value)), '날짜 형식이 올바르지 않습니다.')
  .transform((value) => (value ? new Date(value) : null));

/** "12,000,000" / "1200만" 같은 입력을 숫자로 정규화 */
const money = z
  .string()
  .trim()
  .transform((value) => Number(value.replace(/[,\s원]/g, '')))
  .refine((value) => Number.isFinite(value) && value >= 0, '금액은 0 이상의 숫자여야 합니다.');

const optionalNumber = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : Number(value)))
  .nullable()
  .optional()
  .refine((value) => value === null || value === undefined || Number.isFinite(value), '숫자를 입력해주세요.');

// --- 인증 -------------------------------------------------------------------

export const loginSchema = z.object({
  email,
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
});

export const signupSchema = z
  .object({
    email,
    password,
    passwordConfirm: z.string(),
    name: z.string().trim().min(2, '이름을 2자 이상 입력해주세요.').max(30),
    phone: optionalText(20),
    departmentId: optionalText(40),
    position: optionalText(40),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: '비밀번호가 일치하지 않습니다.',
    path: ['passwordConfirm'],
  });

// --- 업무 -------------------------------------------------------------------

export const taskCreateSchema = z.object({
  title: z.string().trim().min(2, '업무명을 2자 이상 입력해주세요.').max(160),
  description: optionalText(4000),
  status: z.enum(TASK_STATUSES).default('TODO'),
  priority: z.enum(TASK_PRIORITIES).default('MEDIUM'),
  category: z.enum(TASK_CATEGORIES).default('GENERAL'),
  assigneeId: optionalText(40),
  clientId: optionalText(40),
  dealId: optionalText(40),
  startDate: optionalDate,
  dueDate: optionalDate,
  estimatedHours: optionalNumber,
});

export const taskUpdateSchema = taskCreateSchema.extend({
  id: z.string().min(1),
  progress: z
    .string()
    .trim()
    .transform((value) => (value === '' ? 0 : Number(value)))
    .refine((value) => Number.isFinite(value) && value >= 0 && value <= 100, '진행률은 0~100 사이여야 합니다.'),
  actualHours: optionalNumber,
});

export const taskStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(TASK_STATUSES),
});

export const commentSchema = z.object({
  taskId: z.string().min(1),
  content: z.string().trim().min(1, '내용을 입력해주세요.').max(2000),
});

// --- 거래처 -----------------------------------------------------------------

export const clientSchema = z.object({
  name: z.string().trim().min(2, '거래처명을 2자 이상 입력해주세요.').max(120),
  businessNo: optionalText(20),
  ceoName: optionalText(40),
  industry: optionalText(60),
  scale: z.enum(CLIENT_SCALES).default('SMALL'),
  grade: z.enum(CLIENT_GRADES).default('C'),
  status: z.enum(CLIENT_STATUSES).default('PROSPECT'),
  phone: optionalText(30),
  email: optionalText(120),
  website: optionalText(200),
  address: optionalText(200),
  memo: optionalText(2000),
  ownerId: optionalText(40),
});

export const clientUpdateSchema = clientSchema.extend({ id: z.string().min(1) });

export const contactSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().trim().min(2, '담당자명을 입력해주세요.').max(40),
  department: optionalText(60),
  position: optionalText(60),
  phone: optionalText(30),
  mobile: optionalText(30),
  email: optionalText(120),
  isPrimary: z
    .string()
    .optional()
    .transform((value) => value === 'on' || value === 'true'),
  memo: optionalText(1000),
});

export const consultationSchema = z.object({
  clientId: z.string().min(1),
  contactId: optionalText(40),
  dealId: optionalText(40),
  type: z.enum(CONSULTATION_TYPES),
  title: z.string().trim().min(2, '상담 제목을 입력해주세요.').max(160),
  content: z.string().trim().min(2, '상담 내용을 입력해주세요.').max(4000),
  result: z.enum(CONSULTATION_RESULTS).default('NEUTRAL'),
  consultedAt: optionalDate,
  nextAction: optionalText(200),
  nextActionAt: optionalDate,
});

// --- 영업 -------------------------------------------------------------------

export const dealSchema = z.object({
  title: z.string().trim().min(2, '영업건 제목을 입력해주세요.').max(160),
  clientId: z.string().min(1, '거래처를 선택해주세요.'),
  contactId: optionalText(40),
  ownerId: optionalText(40),
  amount: money,
  stage: z.enum(DEAL_STAGES).default('LEAD'),
  probability: z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : Number(value)))
    .nullable()
    .optional()
    .refine(
      (value) => value === null || value === undefined || (Number.isFinite(value) && value >= 0 && value <= 100),
      '수주 확률은 0~100 사이여야 합니다.',
    ),
  contractStatus: z.enum(CONTRACT_STATUSES).default('NONE'),
  contractStartDate: optionalDate,
  contractEndDate: optionalDate,
  expectedCloseDate: optionalDate,
  source: optionalText(60),
  lostReason: optionalText(200),
  memo: optionalText(2000),
});

export const dealUpdateSchema = dealSchema.extend({ id: z.string().min(1) });

export const dealStageSchema = z.object({
  id: z.string().min(1),
  stage: z.enum(DEAL_STAGES),
  lostReason: optionalText(200),
});

// --- 관리자 -----------------------------------------------------------------

export const userCreateSchema = z.object({
  email,
  password,
  name: z.string().trim().min(2, '이름을 입력해주세요.').max(30),
  role: z.enum(ROLES),
  status: z.enum(USER_STATUSES).default('ACTIVE'),
  employeeNo: optionalText(20),
  position: optionalText(40),
  phone: optionalText(20),
  departmentId: optionalText(40),
  hireDate: optionalDate,
});

export const userUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2, '이름을 입력해주세요.').max(30),
  role: z.enum(ROLES),
  status: z.enum(USER_STATUSES),
  employeeNo: optionalText(20),
  position: optionalText(40),
  phone: optionalText(20),
  departmentId: optionalText(40),
  hireDate: optionalDate,
  /** 비어 있으면 기존 비밀번호를 유지한다. */
  password: z
    .string()
    .transform((value) => (value.trim() === '' ? null : value))
    .nullable()
    .refine((value) => value === null || value.length >= 8, '비밀번호는 8자 이상이어야 합니다.'),
});

export const departmentSchema = z.object({
  name: z.string().trim().min(2, '부서명을 입력해주세요.').max(40),
  code: z
    .string()
    .trim()
    .min(2, '부서 코드를 입력해주세요.')
    .max(20)
    .transform((value) => value.toUpperCase()),
  description: optionalText(200),
  costCenter: optionalText(40),
});

export const salesTargetSchema = z.object({
  userId: z.string().min(1, '담당자를 선택해주세요.'),
  year: z.string().transform((value) => Number(value)),
  month: z.string().transform((value) => Number(value)),
  targetAmount: money,
});

/** Zod 실패 결과에서 사용자에게 보여줄 첫 메시지를 추출 */
export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? '입력값을 확인해주세요.';
}

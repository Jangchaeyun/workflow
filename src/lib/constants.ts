/**
 * 도메인 상태값 단일 정의 지점.
 *
 * SQLite는 Prisma enum을 지원하지 않아 DB에는 String으로 저장된다.
 * 대신 이 파일의 `as const` 목록에서 유니온 타입을 파생시켜
 * 서버 액션(Zod) · UI · 통계 집계가 모두 같은 값 집합을 공유하도록 한다.
 */

export const ROLES = ['ADMIN', 'MANAGER', 'SALES', 'EMPLOYEE'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: '시스템 관리자',
  MANAGER: '팀장',
  SALES: '영업담당',
  EMPLOYEE: '직원',
};

export const USER_STATUSES = ['ACTIVE', 'PENDING', 'SUSPENDED', 'RESIGNED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: '재직',
  PENDING: '승인대기',
  SUSPENDED: '이용정지',
  RESIGNED: '퇴사',
};

// --- 업무 -------------------------------------------------------------------

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'HOLD'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: '대기',
  IN_PROGRESS: '진행중',
  REVIEW: '검토',
  DONE: '완료',
  HOLD: '보류',
};

/** 칸반 보드에 노출할 컬럼 순서 */
export const TASK_BOARD_COLUMNS: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'HOLD'];

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: '낮음',
  MEDIUM: '보통',
  HIGH: '높음',
  URGENT: '긴급',
};

export const TASK_PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export const TASK_CATEGORIES = [
  'GENERAL',
  'SALES',
  'SUPPORT',
  'CONTRACT',
  'DEVELOP',
  'CS',
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const TASK_CATEGORY_LABEL: Record<TaskCategory, string> = {
  GENERAL: '일반',
  SALES: '영업',
  SUPPORT: '기술지원',
  CONTRACT: '계약',
  DEVELOP: '개발',
  CS: '고객대응',
};

// --- 거래처 -----------------------------------------------------------------

export const CLIENT_STATUSES = ['PROSPECT', 'ACTIVE', 'DORMANT', 'CHURNED'] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  PROSPECT: '잠재고객',
  ACTIVE: '거래중',
  DORMANT: '휴면',
  CHURNED: '거래종료',
};

export const CLIENT_SCALES = ['LARGE', 'MID', 'SMALL', 'STARTUP'] as const;
export type ClientScale = (typeof CLIENT_SCALES)[number];

export const CLIENT_SCALE_LABEL: Record<ClientScale, string> = {
  LARGE: '대기업',
  MID: '중견기업',
  SMALL: '중소기업',
  STARTUP: '스타트업',
};

export const CLIENT_GRADES = ['A', 'B', 'C', 'D'] as const;
export type ClientGrade = (typeof CLIENT_GRADES)[number];

// --- 영업 -------------------------------------------------------------------

export const DEAL_STAGES = [
  'LEAD',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'LOST',
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const DEAL_STAGE_LABEL: Record<DealStage, string> = {
  LEAD: '리드 발굴',
  QUALIFIED: '검증 완료',
  PROPOSAL: '제안',
  NEGOTIATION: '협상',
  WON: '수주',
  LOST: '실패',
};

/** 파이프라인 보드에 표시할 진행 단계(종료 단계 제외) */
export const DEAL_PIPELINE_STAGES: DealStage[] = [
  'LEAD',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
];

/**
 * 단계별 기본 수주 확률.
 * 가중 매출 예측(amount × probability)의 기준값으로 쓰이며 담당자가 수동 조정할 수 있다.
 */
export const DEAL_STAGE_PROBABILITY: Record<DealStage, number> = {
  LEAD: 10,
  QUALIFIED: 30,
  PROPOSAL: 50,
  NEGOTIATION: 75,
  WON: 100,
  LOST: 0,
};

export const CONTRACT_STATUSES = ['NONE', 'DRAFTING', 'REVIEW', 'SIGNED', 'CANCELLED'] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  NONE: '미진행',
  DRAFTING: '계약서 작성',
  REVIEW: '법무 검토',
  SIGNED: '체결 완료',
  CANCELLED: '해지',
};

// --- 상담 -------------------------------------------------------------------

export const CONSULTATION_TYPES = ['PHONE', 'VISIT', 'EMAIL', 'MEETING', 'ONLINE'] as const;
export type ConsultationType = (typeof CONSULTATION_TYPES)[number];

export const CONSULTATION_TYPE_LABEL: Record<ConsultationType, string> = {
  PHONE: '전화',
  VISIT: '방문',
  EMAIL: '이메일',
  MEETING: '대면회의',
  ONLINE: '온라인미팅',
};

export const CONSULTATION_RESULTS = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'] as const;
export type ConsultationResult = (typeof CONSULTATION_RESULTS)[number];

export const CONSULTATION_RESULT_LABEL: Record<ConsultationResult, string> = {
  POSITIVE: '긍정',
  NEUTRAL: '보통',
  NEGATIVE: '부정',
};

// --- 감사 로그 --------------------------------------------------------------

export const LOG_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'STATUS_CHANGE',
  'PERMISSION_CHANGE',
  'ACCESS_DENIED',
] as const;
export type LogAction = (typeof LOG_ACTIONS)[number];

export const LOG_ACTION_LABEL: Record<LogAction, string> = {
  CREATE: '생성',
  UPDATE: '수정',
  DELETE: '삭제',
  LOGIN: '로그인',
  LOGOUT: '로그아웃',
  STATUS_CHANGE: '상태변경',
  PERMISSION_CHANGE: '권한변경',
  ACCESS_DENIED: '접근거부',
};

/** 감사 로그의 entityType(모델명) → 화면 표기 */
export const LOG_ENTITY_LABEL: Record<string, string> = {
  Task: '업무',
  TaskComment: '업무 댓글',
  Attachment: '첨부파일',
  Client: '거래처',
  Contact: '거래처 담당자',
  Consultation: '상담 기록',
  Deal: '영업건',
  SalesTarget: '영업 목표',
  User: '직원',
  Department: '부서',
  RolePermission: '권한',
  Permission: '권한 검사',
  Session: '세션',
};

/** 감사 로그 변경 내역의 필드명 → 화면 표기 */
export const FIELD_LABEL: Record<string, string> = {
  title: '제목',
  name: '이름',
  description: '설명',
  status: '상태',
  priority: '우선순위',
  category: '분류',
  progress: '진행률',
  assigneeId: '담당자',
  reporterId: '요청자',
  clientId: '거래처',
  dealId: '영업건',
  contactId: '거래처 담당자',
  ownerId: '담당 영업',
  startDate: '시작일',
  dueDate: '마감일',
  completedAt: '완료일',
  estimatedHours: '예상 공수',
  actualHours: '실제 공수',
  amount: '금액',
  stage: '영업 단계',
  probability: '수주 확률',
  contractStatus: '계약 상태',
  contractStartDate: '계약 시작일',
  contractEndDate: '계약 종료일',
  expectedCloseDate: '마감 예정일',
  closedAt: '종료일',
  lostReason: '실패 사유',
  source: '유입 경로',
  memo: '메모',
  grade: '등급',
  scale: '기업 규모',
  businessNo: '사업자번호',
  ceoName: '대표자',
  industry: '업종',
  phone: '연락처',
  email: '이메일',
  website: '홈페이지',
  address: '주소',
  role: '역할',
  employeeNo: '사원번호',
  position: '직위',
  departmentId: '부서',
  hireDate: '입사일',
  password: '비밀번호',
  code: '코드',
  costCenter: '코스트센터',
  targetAmount: '목표 금액',
  isPrimary: '주 담당자',
  before: '변경 전',
  after: '변경 후',
};

export const PAGE_SIZE = 15;

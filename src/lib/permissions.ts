import type { Role } from './constants';

/**
 * 권한 카탈로그.
 *
 * 역할(Role)에 기능을 직접 하드코딩하지 않고 "역할 → 권한 → 기능" 구조로 분리했다.
 * 덕분에 관리자가 `/admin/permissions` 에서 조직 정책에 맞게 매트릭스를 바꿀 수 있고,
 * 코드에서는 항상 권한 키만 확인하므로 역할이 추가돼도 검증 로직을 고칠 필요가 없다.
 */
export const PERMISSION_GROUPS = [
  {
    key: 'common',
    label: '공통',
    permissions: [{ key: 'dashboard:view', label: '대시보드 조회' }],
  },
  {
    key: 'task',
    label: '업무관리',
    permissions: [
      { key: 'task:read:own', label: '내 업무 조회' },
      { key: 'task:read:all', label: '전체 업무 조회' },
      { key: 'task:create', label: '업무 등록' },
      { key: 'task:update:own', label: '내 업무 수정' },
      { key: 'task:update:all', label: '전체 업무 수정' },
      { key: 'task:assign', label: '담당자 지정' },
      { key: 'task:delete', label: '업무 삭제' },
    ],
  },
  {
    key: 'client',
    label: '거래처관리',
    permissions: [
      { key: 'client:read', label: '거래처 조회' },
      { key: 'client:create', label: '거래처 등록' },
      { key: 'client:update', label: '거래처 수정' },
      { key: 'client:delete', label: '거래처 삭제' },
      { key: 'contact:manage', label: '거래처 담당자 관리' },
      { key: 'consultation:read', label: '상담 기록 조회' },
      { key: 'consultation:create', label: '상담 기록 작성' },
    ],
  },
  {
    key: 'sales',
    label: '영업관리',
    permissions: [
      { key: 'deal:read:own', label: '내 영업건 조회' },
      { key: 'deal:read:all', label: '전체 영업건 조회' },
      { key: 'deal:create', label: '영업건 등록' },
      { key: 'deal:update', label: '영업건 수정 · 단계 변경' },
      { key: 'deal:delete', label: '영업건 삭제' },
      { key: 'report:sales', label: '매출 통계 조회' },
    ],
  },
  {
    key: 'admin',
    label: '시스템 관리',
    permissions: [
      { key: 'user:read', label: '회원 · 직원 조회' },
      { key: 'user:create', label: '직원 등록' },
      { key: 'user:update', label: '직원 정보 수정' },
      { key: 'user:approve', label: '가입 승인 · 상태 변경' },
      { key: 'user:delete', label: '직원 삭제' },
      { key: 'department:manage', label: '부서 관리' },
      { key: 'permission:manage', label: '권한 관리' },
      { key: 'log:read', label: '활동 로그 조회' },
    ],
  },
] as const;

export type PermissionKey =
  (typeof PERMISSION_GROUPS)[number]['permissions'][number]['key'];

export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map((permission) => permission.key),
);

export const PERMISSION_LABEL = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((group) =>
    group.permissions.map((permission) => [permission.key, permission.label]),
  ),
) as Record<PermissionKey, string>;

/**
 * 최초 시드 및 "기본값으로 초기화" 시 적용되는 역할별 권한.
 * 실제 판정은 항상 DB(RolePermission)에 저장된 값을 사용한다.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, PermissionKey[]> = {
  ADMIN: [...ALL_PERMISSIONS],
  MANAGER: [
    'dashboard:view',
    'task:read:own',
    'task:read:all',
    'task:create',
    'task:update:own',
    'task:update:all',
    'task:assign',
    'task:delete',
    'client:read',
    'client:create',
    'client:update',
    'contact:manage',
    'consultation:read',
    'consultation:create',
    'deal:read:own',
    'deal:read:all',
    'deal:create',
    'deal:update',
    'report:sales',
    'user:read',
    'log:read',
  ],
  SALES: [
    'dashboard:view',
    'task:read:own',
    'task:create',
    'task:update:own',
    'client:read',
    'client:create',
    'client:update',
    'contact:manage',
    'consultation:read',
    'consultation:create',
    'deal:read:own',
    'deal:create',
    'deal:update',
  ],
  EMPLOYEE: [
    'dashboard:view',
    'task:read:own',
    'task:create',
    'task:update:own',
    'client:read',
    'consultation:read',
  ],
};

export type PermissionMatrix = Record<Role, Set<PermissionKey>>;

export function buildDefaultMatrix(): PermissionMatrix {
  return {
    ADMIN: new Set(DEFAULT_ROLE_PERMISSIONS.ADMIN),
    MANAGER: new Set(DEFAULT_ROLE_PERMISSIONS.MANAGER),
    SALES: new Set(DEFAULT_ROLE_PERMISSIONS.SALES),
    EMPLOYEE: new Set(DEFAULT_ROLE_PERMISSIONS.EMPLOYEE),
  };
}

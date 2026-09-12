import type { PermissionKey } from './permissions';

export type NavIcon =
  | 'dashboard'
  | 'today'
  | 'tasks'
  | 'board'
  | 'clients'
  | 'pipeline'
  | 'report'
  | 'users'
  | 'departments'
  | 'permissions'
  | 'logs';

interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** 이 중 하나라도 가지고 있으면 메뉴를 노출한다. */
  permissions: PermissionKey[];
  description?: string;
}

interface NavSection {
  label: string | null;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    items: [
      {
        href: '/dashboard',
        label: '대시보드',
        icon: 'dashboard',
        permissions: ['dashboard:view'],
      },
      {
        href: '/today',
        label: '오늘 할 일',
        icon: 'today',
        permissions: ['dashboard:view'],
      },
    ],
  },
  {
    label: '업무',
    items: [
      {
        href: '/tasks',
        label: '업무 목록',
        icon: 'tasks',
        permissions: ['task:read:own', 'task:read:all'],
      },
      {
        href: '/tasks/board',
        label: '칸반 보드',
        icon: 'board',
        permissions: ['task:read:own', 'task:read:all'],
      },
    ],
  },
  {
    label: '영업',
    items: [
      {
        href: '/clients',
        label: '거래처',
        icon: 'clients',
        permissions: ['client:read'],
      },
      {
        href: '/sales',
        label: '영업 파이프라인',
        icon: 'pipeline',
        permissions: ['deal:read:own', 'deal:read:all'],
      },
      {
        href: '/sales/reports',
        label: '매출 통계',
        icon: 'report',
        permissions: ['report:sales'],
      },
    ],
  },
  {
    label: '시스템 관리',
    items: [
      {
        href: '/admin/users',
        label: '직원 관리',
        icon: 'users',
        permissions: ['user:read'],
      },
      {
        href: '/admin/departments',
        label: '부서 관리',
        icon: 'departments',
        permissions: ['department:manage'],
      },
      {
        href: '/admin/permissions',
        label: '권한 관리',
        icon: 'permissions',
        permissions: ['permission:manage'],
      },
      {
        href: '/admin/logs',
        label: '활동 로그',
        icon: 'logs',
        permissions: ['log:read'],
      },
    ],
  },
];

export interface VisibleNavItem {
  href: string;
  label: string;
  icon: NavIcon;
}

export interface VisibleNavSection {
  label: string | null;
  items: VisibleNavItem[];
}

/**
 * 권한이 없는 메뉴는 아예 렌더링하지 않는다.
 * (URL 을 직접 입력해도 페이지 단계의 requirePermission 이 다시 막는다.)
 */
export function filterNavigation(permissions: Set<PermissionKey>): VisibleNavSection[] {
  return NAV_SECTIONS.map((section) => ({
    label: section.label,
    items: section.items
      .filter((item) => item.permissions.some((permission) => permissions.has(permission)))
      .map(({ href, label, icon }) => ({ href, label, icon })),
  })).filter((section) => section.items.length > 0);
}

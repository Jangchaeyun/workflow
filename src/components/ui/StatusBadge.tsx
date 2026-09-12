import {
  CLIENT_STATUS_LABEL,
  CONSULTATION_RESULT_LABEL,
  CONTRACT_STATUS_LABEL,
  DEAL_STAGE_LABEL,
  ROLE_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  USER_STATUS_LABEL,
  type ClientStatus,
  type ConsultationResult,
  type ContractStatus,
  type DealStage,
  type Role,
  type TaskPriority,
  type TaskStatus,
  type UserStatus,
} from '@/lib/constants';
import { Badge, type BadgeTone } from './Badge';

/**
 * 도메인 상태값 → 배지 색상 매핑을 한곳에 모아
 * 목록·상세·대시보드에서 같은 상태가 항상 같은 색으로 보이도록 한다.
 */

const TASK_STATUS_TONE: Record<TaskStatus, BadgeTone> = {
  TODO: 'neutral',
  IN_PROGRESS: 'brand',
  REVIEW: 'info',
  DONE: 'positive',
  HOLD: 'caution',
};

const TASK_PRIORITY_TONE: Record<TaskPriority, BadgeTone> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'caution',
  URGENT: 'danger',
};

const CLIENT_STATUS_TONE: Record<ClientStatus, BadgeTone> = {
  PROSPECT: 'info',
  ACTIVE: 'positive',
  DORMANT: 'caution',
  CHURNED: 'danger',
};

const DEAL_STAGE_TONE: Record<DealStage, BadgeTone> = {
  LEAD: 'neutral',
  QUALIFIED: 'info',
  PROPOSAL: 'brand',
  NEGOTIATION: 'caution',
  WON: 'positive',
  LOST: 'danger',
};

const CONTRACT_STATUS_TONE: Record<ContractStatus, BadgeTone> = {
  NONE: 'neutral',
  DRAFTING: 'info',
  REVIEW: 'caution',
  SIGNED: 'positive',
  CANCELLED: 'danger',
};

const USER_STATUS_TONE: Record<UserStatus, BadgeTone> = {
  ACTIVE: 'positive',
  PENDING: 'caution',
  SUSPENDED: 'danger',
  RESIGNED: 'neutral',
};

const ROLE_TONE: Record<Role, BadgeTone> = {
  ADMIN: 'danger',
  MANAGER: 'brand',
  SALES: 'info',
  EMPLOYEE: 'neutral',
};

const CONSULTATION_RESULT_TONE: Record<ConsultationResult, BadgeTone> = {
  POSITIVE: 'positive',
  NEUTRAL: 'neutral',
  NEGATIVE: 'danger',
};

export function TaskStatusBadge({ value }: { value: string }) {
  const status = value as TaskStatus;
  return (
    <Badge tone={TASK_STATUS_TONE[status] ?? 'neutral'} dot>
      {TASK_STATUS_LABEL[status] ?? value}
    </Badge>
  );
}

export function TaskPriorityBadge({ value }: { value: string }) {
  const priority = value as TaskPriority;
  return <Badge tone={TASK_PRIORITY_TONE[priority] ?? 'neutral'}>{TASK_PRIORITY_LABEL[priority] ?? value}</Badge>;
}

export function ClientStatusBadge({ value }: { value: string }) {
  const status = value as ClientStatus;
  return (
    <Badge tone={CLIENT_STATUS_TONE[status] ?? 'neutral'} dot>
      {CLIENT_STATUS_LABEL[status] ?? value}
    </Badge>
  );
}

export function DealStageBadge({ value }: { value: string }) {
  const stage = value as DealStage;
  return (
    <Badge tone={DEAL_STAGE_TONE[stage] ?? 'neutral'} dot>
      {DEAL_STAGE_LABEL[stage] ?? value}
    </Badge>
  );
}

export function ContractStatusBadge({ value }: { value: string }) {
  const status = value as ContractStatus;
  return <Badge tone={CONTRACT_STATUS_TONE[status] ?? 'neutral'}>{CONTRACT_STATUS_LABEL[status] ?? value}</Badge>;
}

export function UserStatusBadge({ value }: { value: string }) {
  const status = value as UserStatus;
  return (
    <Badge tone={USER_STATUS_TONE[status] ?? 'neutral'} dot>
      {USER_STATUS_LABEL[status] ?? value}
    </Badge>
  );
}

export function RoleBadge({ value }: { value: string }) {
  const role = value as Role;
  return <Badge tone={ROLE_TONE[role] ?? 'neutral'}>{ROLE_LABEL[role] ?? value}</Badge>;
}

export function ConsultationResultBadge({ value }: { value: string }) {
  const result = value as ConsultationResult;
  return (
    <Badge tone={CONSULTATION_RESULT_TONE[result] ?? 'neutral'}>
      {CONSULTATION_RESULT_LABEL[result] ?? value}
    </Badge>
  );
}

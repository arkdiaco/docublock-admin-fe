import {
  OPEN_STATUSES,
  TICKET_PRIORITIES,
  type SlaMatrix,
  type SlaPolicy,
  type SlaRule,
  type SupportAuthorType,
  type TicketAssignment,
  type TicketAuditEntry,
  type TicketPriority,
  type TicketSla,
  type TicketStatus,
  type TicketSummary,
  type TicketsQuery,
} from './support.models';

export type TicketView = 'todos' | 'abiertos' | 'sin-asignar' | 'vencidos' | 'incumplidos';

export const TICKET_VIEWS: readonly TicketView[] = [
  'todos',
  'abiertos',
  'sin-asignar',
  'vencidos',
  'incumplidos',
];

export const VIEW_QUERY: Record<TicketView, Partial<TicketsQuery>> = {
  todos: {},
  abiertos: { open: true },
  'sin-asignar': { open: true, unassigned: true },
  vencidos: { overdue: true },
  incumplidos: { breached: true },
};

export const isTicketView = (value: string | null): value is TicketView =>
  TICKET_VIEWS.includes(value as TicketView);

export type StateFamily = 'active' | 'trial' | 'warning' | 'suspended' | 'closed';

export const STATUS_FAMILY: Record<TicketStatus, StateFamily> = {
  open: 'warning',
  pending: 'trial',
  in_progress: 'trial',
  waiting_customer: 'trial',
  resolved: 'active',
  closed: 'closed',
};

export const PRIORITY_FAMILY: Record<TicketPriority, StateFamily> = {
  critical: 'suspended',
  high: 'warning',
  normal: 'trial',
  low: 'closed',
};

export const isOpenStatus = (status: TicketStatus): boolean => OPEN_STATUSES.includes(status);

export type SlaState = 'breached' | 'overdue' | 'onTime' | 'met';

export const SLA_FAMILY: Record<SlaState, StateFamily> = {
  breached: 'suspended',
  overdue: 'warning',
  onTime: 'trial',
  met: 'active',
};

const before = (value: string | null, now: Date): boolean =>
  value !== null && new Date(value).getTime() < now.getTime();

export const slaStateOf = (ticket: Pick<TicketSummary, 'status' | 'sla'>, now: Date): SlaState => {
  const { sla } = ticket;
  if (sla.firstResponseBreached || sla.resolutionBreached) return 'breached';
  if (!isOpenStatus(ticket.status)) return 'met';
  const firstLate = sla.firstRespondedAt === null && before(sla.firstResponseDueAt, now);
  const resolutionLate = sla.resolvedAt === null && before(sla.resolutionDueAt, now);
  return firstLate || resolutionLate ? 'overdue' : 'onTime';
};

export type GoalState = 'met' | 'breached' | 'overdue' | 'pending';

export interface SlaGoal {
  key: 'firstResponse' | 'resolution';
  minutes: number;
  dueAt: string;
  doneAt: string | null;
  state: GoalState;
}

const goalState = (
  doneAt: string | null,
  breached: boolean,
  dueAt: string,
  open: boolean,
  now: Date,
): GoalState => {
  if (breached) return 'breached';
  if (doneAt) return 'met';
  if (open && before(dueAt, now)) return 'overdue';
  return 'pending';
};

export const slaGoalsOf = (ticket: Pick<TicketSummary, 'status' | 'sla'>, now: Date): SlaGoal[] => {
  const { sla } = ticket;
  const open = isOpenStatus(ticket.status);
  return [
    {
      key: 'firstResponse',
      minutes: sla.firstResponseMinutes,
      dueAt: sla.firstResponseDueAt,
      doneAt: sla.firstRespondedAt,
      state: goalState(
        sla.firstRespondedAt,
        sla.firstResponseBreached,
        sla.firstResponseDueAt,
        open,
        now,
      ),
    },
    {
      key: 'resolution',
      minutes: sla.resolutionMinutes,
      dueAt: sla.resolutionDueAt,
      doneAt: sla.resolvedAt,
      state: goalState(sla.resolvedAt, sla.resolutionBreached, sla.resolutionDueAt, open, now),
    },
  ];
};

export const GOAL_FAMILY: Record<GoalState, StateFamily> = {
  met: 'active',
  breached: 'suspended',
  overdue: 'warning',
  pending: 'trial',
};

export interface DurationPart {
  unit: 'd' | 'h' | 'min';
  n: number;
}

export const durationParts = (minutes: number | null): DurationPart[] => {
  if (minutes === null || !Number.isFinite(minutes) || minutes < 0) return [];
  const total = Math.round(minutes);
  if (total === 0) return [{ unit: 'min', n: 0 }];
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  const parts: DurationPart[] = [];
  if (days) parts.push({ unit: 'd', n: days });
  if (hours) parts.push({ unit: 'h', n: hours });
  if (mins && !days) parts.push({ unit: 'min', n: mins });
  return parts;
};

export const isDefaultPolicyName = (sla: Pick<TicketSla, 'policyName'>): boolean =>
  !sla.policyName || sla.policyName === 'default';

export const AUTHOR_KIND: Record<SupportAuthorType, 'person' | 'system' | 'support'> = {
  agent: 'support',
  user: 'person',
  signer: 'person',
  system: 'system',
};

export type AuditValueKind = 'status' | 'priority' | 'agent' | 'none';

export const auditValueKindOf = (action: TicketAuditEntry['action']): AuditValueKind => {
  switch (action) {
    case 'status_change':
    case 'reopened':
    case 'resolved':
    case 'closed':
      return 'status';
    case 'priority_change':
      return 'priority';
    case 'assignment':
      return 'agent';
    default:
      return 'none';
  }
};

export const staffNamesOf = (
  assignments: readonly TicketAssignment[],
  assignee: { id: string; name?: string } | null,
): Map<string, string> => {
  const names = new Map<string, string>();
  for (const entry of assignments) {
    if (entry.assignedToName) names.set(entry.assignedToId, entry.assignedToName);
    if (entry.assignedById && entry.assignedByName)
      names.set(entry.assignedById, entry.assignedByName);
  }
  if (assignee?.name) names.set(assignee.id, assignee.name);
  return names;
};

export const attachmentNameOf = (ref: string): string => {
  const clean = ref.split(/[?#]/)[0] ?? ref;
  const last = clean.split('/').filter(Boolean).pop() ?? ref;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
};

const isRule = (value: unknown): value is SlaRule =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as SlaRule).firstResponseMinutes === 'number' &&
  typeof (value as SlaRule).resolutionMinutes === 'number';

export const DEFAULT_MATRIX: SlaMatrix = {
  low: { firstResponseMinutes: 2880, resolutionMinutes: 7200 },
  normal: { firstResponseMinutes: 1440, resolutionMinutes: 4320 },
  high: { firstResponseMinutes: 240, resolutionMinutes: 1440 },
  critical: { firstResponseMinutes: 60, resolutionMinutes: 480 },
};

export const matrixOf = (policy: Pick<SlaPolicy, 'matrix'> | null): SlaMatrix =>
  TICKET_PRIORITIES.reduce((matrix, priority) => {
    const rule = policy?.matrix?.[priority];
    matrix[priority] = isRule(rule) ? { ...rule } : { ...DEFAULT_MATRIX[priority] };
    return matrix;
  }, {} as SlaMatrix);

export const MAX_SLA_MINUTES = 525_600;

export const isValidMinutes = (value: number): boolean =>
  Number.isInteger(value) && value >= 1 && value <= MAX_SLA_MINUTES;

export const matrixProblemOf = (matrix: SlaMatrix): string | null => {
  for (const priority of TICKET_PRIORITIES) {
    const rule = matrix[priority];
    if (!isValidMinutes(rule.firstResponseMinutes) || !isValidMinutes(rule.resolutionMinutes))
      return 'range';
    if (rule.resolutionMinutes < rule.firstResponseMinutes) return 'order';
  }
  return null;
};

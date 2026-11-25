export const ERROR_SERVICES = ['core', 'commons', 'bridge'] as const;
export type ErrorService = (typeof ERROR_SERVICES)[number];

export const ERROR_GROUP_STATES = ['open', 'resolved', 'silenced'] as const;
export type ErrorGroupState = (typeof ERROR_GROUP_STATES)[number];

export interface ErrorGroupTriage {
  adminId: string;
  adminName: string | null;
  at: string;
}

export interface ErrorGroupAffected {
  documents: number;
  capped: boolean;
}

export interface ErrorGroupRow {
  id: string;
  service: ErrorService;
  source: 'http' | 'job';
  kind: string;
  route: string;
  message: string;
  lastStatus: number | null;
  state: ErrorGroupState;
  count: number;
  firstSeen: string;
  lastSeen: string;
  reopenedAt?: string;
  triage?: ErrorGroupTriage;
  affected?: ErrorGroupAffected;
}

export interface ErrorActor {
  userId?: string;
  organizationId?: string;
  platformAdminId?: string;
  integrationKeyId?: string;
  callerService?: string;
}

export interface ErrorContext {
  organization?: { id: string; name?: string; tributaryNumber?: string };
  document?: { id: string; code?: string; name?: string };
  signer?: { id?: string; identityId?: string; name?: string; identification?: string };
}

export interface ErrorSample {
  id: string;
  occurredAt: string;
  message: string;
  status?: number;
  method?: string;
  path?: string;
  query?: unknown;
  body?: unknown;
  actor?: ErrorActor;
  requestId?: string;
  stack?: string;
  context?: ErrorContext;
}

export interface ErrorGroupDetail extends ErrorGroupRow {
  samples: ErrorSample[];
}

export type ErrorGroupTotals = Record<ErrorGroupState, number>;

export interface ErrorGroupReport {
  total: number;
  page: number;
  limit: number;
  items: ErrorGroupRow[];
  totals: ErrorGroupTotals;
}

export interface ErrorLogsQuery {
  service: ErrorService | null;
  state: ErrorGroupState | null;
  search: string | null;
  document: string | null;
  from: string | null;
  page: number;
  limit: number;
}

export interface ErrorLogFilters {
  state: ErrorGroupState | null;
  service: ErrorService | null;
  search: string | null;
  period: string | null;
  document: string | null;
  group: string | null;
  page: number;
}

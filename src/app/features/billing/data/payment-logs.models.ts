export const PAYMENT_LOG_PROVIDERS = ['stripe', 'alohapay'] as const;
export type PaymentLogProvider = (typeof PAYMENT_LOG_PROVIDERS)[number];

export const PAYMENT_LOG_DIRECTIONS = ['in', 'out'] as const;
export type PaymentLogDirection = (typeof PAYMENT_LOG_DIRECTIONS)[number];

export const PAYMENT_LOG_STAGES = ['intake', 'apply', 'call'] as const;
export type PaymentLogStage = (typeof PAYMENT_LOG_STAGES)[number];

export const PAYMENT_LOG_RESULTS = ['ok', 'failed'] as const;
export type PaymentLogResult = (typeof PAYMENT_LOG_RESULTS)[number];

export interface PaymentLogFailure {
  message: string;
  code?: string;
  status?: number;
  stack?: string;
}

export interface PaymentLogRow {
  id: string;
  direction: PaymentLogDirection;
  provider: PaymentLogProvider;
  stage: PaymentLogStage;
  operation: string;
  eventId?: string;
  organizationId?: string;
  organizationName: string | null;
  reference?: string;
  planCode?: string;
  replayOf?: string;
  ok: boolean;
  outcome: string | null;
  error?: PaymentLogFailure;
  durationMs: number;
  at: string;
}

export interface PaymentLogDetail extends PaymentLogRow {
  request: unknown;
  response: unknown;
}

export interface PaymentLogTotals {
  all: number;
  failed: number;
}

export interface PaymentLogReport {
  total: number;
  page: number;
  limit: number;
  items: PaymentLogRow[];
  totals: PaymentLogTotals;
}

export interface PaymentLogFilters {
  result: PaymentLogResult | null;
  provider: PaymentLogProvider | null;
  stage: PaymentLogStage | null;
  organizationId: string | null;
  search: string | null;
  period: string | null;
  page: number;
}

export interface PaymentLogsQuery {
  ok: boolean | null;
  provider: PaymentLogProvider | null;
  stage: PaymentLogStage | null;
  organizationId: string | null;
  search: string | null;
  from: string | null;
  page: number;
  limit: number;
}

export interface PaymentLogReplay {
  outcome: string;
}

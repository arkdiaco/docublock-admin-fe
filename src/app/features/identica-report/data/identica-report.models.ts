export const IDENTICA_GROUPS = ['identica', 'review', 'docublock', 'ok'] as const;
export type IdenticaGroup = (typeof IDENTICA_GROUPS)[number];

export const IDENTICA_CATEGORIES = [
  'identica_no_response',
  'identica_server_error',
  'identica_internal_error',
  'access_denied',
  'before_call',
  'unclassified',
  'request_rejected',
  'approved',
  'negative',
] as const;
export type IdenticaCategory = (typeof IDENTICA_CATEGORIES)[number];

export const IDENTICA_SERVICES = ['ani', 'matcher-facial', 'liveness', 'auth'] as const;

export interface IdenticaCounts {
  total: number;
  identica: number;
  review: number;
  docublock: number;
  ok: number;
}

export interface IdenticaReason {
  service: string;
  category: IdenticaCategory;
  group: IdenticaGroup;
  httpStatus: number | null;
  responseCode: string | null;
  message: string | null;
  count: number;
}

export interface IdenticaReportSummary {
  from: string;
  to: string;
  timeZone: string;
  totals: IdenticaCounts;
  categories: { category: IdenticaCategory; group: IdenticaGroup; count: number }[];
  services: (IdenticaCounts & { service: string })[];
  months: (IdenticaCounts & { month: string })[];
  reasons: IdenticaReason[];
}

export interface IdenticaReportRequest {
  from?: string;
  to?: string;
  tz: string;
}

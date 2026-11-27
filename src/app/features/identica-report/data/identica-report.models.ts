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

export const IDENTICA_CATEGORY_GROUP: Record<IdenticaCategory, IdenticaGroup> = {
  identica_no_response: 'identica',
  identica_server_error: 'identica',
  identica_internal_error: 'identica',
  access_denied: 'review',
  before_call: 'review',
  unclassified: 'review',
  request_rejected: 'docublock',
  approved: 'ok',
  negative: 'ok',
};

export const IDENTICA_SERVICES = ['ani', 'matcher-facial', 'liveness', 'auth'] as const;
export type IdenticaService = (typeof IDENTICA_SERVICES)[number];

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

export interface IdenticaQueryItem {
  id: string | null;
  occurredAt: string;
  service: string;
  serviceId: string | null;
  category: IdenticaCategory;
  group: IdenticaGroup;
  httpStatus: number | null;
  responseCode: string | null;
  message: string | null;
  durationMs: number | null;
  document: { id: string; code: string | null; name: string | null } | null;
  organization: { id: string; name: string | null; tributaryNumber: string | null } | null;
  signer: { id: string; name: string | null; identification: string | null } | null;
}

export interface IdenticaQueriesPage {
  from: string;
  to: string;
  timeZone: string;
  page: number;
  limit: number;
  total: number;
  items: IdenticaQueryItem[];
}

export interface IdenticaExportRequest extends IdenticaReportRequest {
  group?: IdenticaGroup;
  category?: IdenticaCategory;
  service?: IdenticaService;
}

export interface IdenticaQueriesRequest extends IdenticaExportRequest {
  page?: number;
  limit?: number;
}

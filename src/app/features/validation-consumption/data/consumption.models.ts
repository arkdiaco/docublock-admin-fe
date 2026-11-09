import type { ValidationPricing } from '../../organizations/data/validations.models';

export interface ConsumptionCounts {
  ani: number;
  liveness: number;
  macherFacial: number;
  otros: number;
  total: number;
}

export const COUNT_KEYS = ['ani', 'liveness', 'macherFacial', 'otros'] as const;

export type CountKey = (typeof COUNT_KEYS)[number];

export interface ConsumptionBilling {
  currency: string;
  lines: { concept: string; quantity: number; unitPrice: number; amount: number }[];
  total: number;
}

export interface OrganizationConsumption {
  organizationId: string;
  businessName: string;
  reseller: { id: string; businessName: string } | null;
  counts: ConsumptionCounts;
  packages: number;
  pricing: ValidationPricing | null;
  billedViaReseller: boolean;
  billing: ConsumptionBilling | null;
}

export interface ResellerConsumption {
  resellerId: string | null;
  businessName: string;
  organizations: number;
  counts: ConsumptionCounts;
  packages: number;
  pricing: ValidationPricing | null;
  billing: ConsumptionBilling | null;
}

export interface ConsumptionReport {
  from?: string;
  to?: string;
  totals: ConsumptionCounts;
  organizations: OrganizationConsumption[];
  resellers: ResellerConsumption[];
}

export type ConsumptionView = 'organizaciones' | 'resellers';

export const CONSUMPTION_VIEWS: readonly ConsumptionView[] = ['organizaciones', 'resellers'];

export interface ConsumptionFilters {
  from: string | null;
  to: string | null;
  view: ConsumptionView;
}

export type DetailScope = 'organization' | 'reseller';

export type DetailResult = 'passed' | 'failed' | 'retry' | 'unknown';

export interface DetailValidation {
  type: CountKey;
  rawType: string;
  date: string;
  result: DetailResult;
  retry: boolean;
  copy: boolean;
  source: 'legacy' | 'core';
}

export interface DetailSigner {
  identityId: string;
  signerId?: string;
  name: string;
  identification?: string;
  counts: ConsumptionCounts;
  validations: DetailValidation[];
}

export interface DetailItem {
  month: string;
  document: { id: string; name: string; code?: string };
  organization: { id: string; name: string };
  counts: ConsumptionCounts;
  signers: DetailSigner[];
}

export interface DetailMonth {
  month: string;
  documents: number;
  signers: number;
  packages: number;
  counts: ConsumptionCounts;
  billing: ConsumptionBilling | null;
}

export interface ValidationDetail {
  scope: DetailScope;
  entity: { id: string; businessName: string };
  billedVia: { id: string; businessName: string } | null;
  pricing: { configured: boolean; mode: 'package' | 'per_validation'; currency: string } | null;
  from?: string;
  to?: string;
  timeZone: string;
  capped: boolean;
  totals: ConsumptionCounts;
  packages: number;
  billing: ConsumptionBilling | null;
  months: DetailMonth[];
  total: number;
  page: number;
  limit: number;
  items: DetailItem[];
}

export type DetailType = CountKey | 'todos';

export interface DetailFilters extends ConsumptionFilters {
  type: DetailType;
  search: string;
  page: number;
}

export interface DetailRequest {
  scope: DetailScope;
  entityId: string;
  from?: string;
  to?: string;
  type?: CountKey;
  search?: string;
  tz: string;
}

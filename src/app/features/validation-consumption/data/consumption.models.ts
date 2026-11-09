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

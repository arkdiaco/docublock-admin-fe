import type {
  ConsumptionBilling,
  ConsumptionCounts,
  CountKey,
  DetailResult,
} from '../../validation-consumption/data/consumption.models';

export interface HistoryEntity {
  id: string;
  businessName: string;
}

export interface HistoryPricing {
  configured: boolean;
  mode: 'package' | 'per_validation';
  currency: string;
}

export interface HistoryOrganization {
  organization: HistoryEntity | null;
  counts: ConsumptionCounts;
  signers: number;
  billing: ConsumptionBilling | null;
  pricing: HistoryPricing | null;
}

export interface HistoryGroup {
  reseller: HistoryEntity | null;
  counts: ConsumptionCounts;
  signers: number;
  billing: ConsumptionBilling | null;
  pricing: HistoryPricing | null;
  organizations: HistoryOrganization[];
}

export interface ValidationHistory {
  scope: { type: 'all' | 'reseller' | 'organization'; entity: HistoryEntity | null };
  cutoff: string;
  from?: string;
  to: string;
  timeZone: string;
  capped: boolean;
  totals: ConsumptionCounts;
  signers: number;
  groups: HistoryGroup[];
}

export interface HistoryValidation {
  type: CountKey;
  rawType: string;
  date: string;
  result: DetailResult;
  retry: boolean;
  copy: boolean;
}

export interface HistorySigner {
  id: string;
  name: string;
  identification?: string;
  organizations: number;
  counts: ConsumptionCounts;
  validations: HistoryValidation[];
}

export interface HistorySignersPage {
  organization: HistoryEntity | null;
  total: number;
  page: number;
  limit: number;
  items: HistorySigner[];
}

export interface HistoryFilters {
  resellerId: string | null;
  organizationId: string | null;
  from: string | null;
  to: string;
}

export interface HistoryRequest {
  resellerId?: string;
  organizationId?: string;
  from?: string;
  to?: string;
  tz: string;
}

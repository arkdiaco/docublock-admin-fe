export const LIST_STATES = ['expiring', 'expired', 'none', 'active', 'all'] as const;
export type SubscriptionListState = (typeof LIST_STATES)[number];
export type SubscriptionRowState = Exclude<SubscriptionListState, 'all'>;

export const WINDOWS = [7, 15, 30] as const;
export const SOURCES = ['STRIPE', 'ALOHAPAY', 'MANUAL', 'RESELLER', 'LEGACY'] as const;

export interface SubscriptionsFilter {
  state: SubscriptionListState;
  days: number;
  planCode?: string;
  source?: string;
  countryId?: string;
  search?: string;
  includeTest: boolean;
  includeAutoRenew: boolean;
}

export interface SubscriptionsQuery extends SubscriptionsFilter {
  page: number;
  limit: number;
}

export interface SubscriptionRow {
  organization: {
    id: string;
    businessName: string;
    tributaryNumber: string;
    countryId?: string;
    isTest: boolean;
  };
  countryName?: string;
  subscription: {
    id: string;
    source: string;
    periodStart: string | null;
    periodEnd: string | null;
    daysLeft: number | null;
  } | null;
  plan: { code: string; name: string; version: number } | null;
  documents: { used: number; limit: number | null } | null;
  lastEndedAt: string | null;
  autoRenew: boolean;
  state: SubscriptionRowState;
}

export interface SubscriptionsPage {
  total: number;
  counts: Record<SubscriptionRowState, number>;
  items: SubscriptionRow[];
}

export interface Option {
  id: string;
  label: string;
}

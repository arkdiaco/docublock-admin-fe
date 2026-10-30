export type PlanKind = 'SUBSCRIPTION' | 'PACKAGE';
export type PlanState = 'ACTIVE' | 'RETIRED';
export type PlanListState = 'active' | 'retired' | 'all';

export const PLAN_FAMILIES = ['DEMO', 'CORE', 'PRIME', 'GOVERNANCE', 'PAYG'] as const;
export type PlanFamily = (typeof PLAN_FAMILIES)[number];

export const LIMIT_KEYS = ['documents', 'idBiometric', 'idAni', 'idIdentity'] as const;
export type LimitKey = (typeof LIMIT_KEYS)[number];
export type PlanLimits = Record<LimitKey, number | null>;

export const NEGOTIATED_PRICE = -1;

export interface PlanRow {
  code: string;
  name: string;
  family: string;
  kind: PlanKind;
  state: PlanState;
  version: number;
  versions: number;
  countryId?: string;
  countryName?: string;
  currency: string;
  priceMonthly: number;
  priceAnnual: number;
  priceOnce: number | null;
  validityMonths: number | null;
  negotiated: boolean;
  limits: PlanLimits;
  visible: boolean;
  stripeReady: boolean | null;
  subscribers: number;
  protected: boolean;
}

export interface PlanVersion {
  id: string;
  version: number;
  state: PlanState;
  name: string;
  createdAt?: string;
  countryId?: string;
  currency: string;
  priceMonthly: number;
  priceAnnual: number;
  priceOnce: number | null;
  validityMonths: number | null;
  negotiated: boolean;
  limits: PlanLimits;
  visible: boolean;
  stripe: { monthly: string | null; annual: string | null; once: string | null };
  stripeReady: boolean | null;
  subscribers: number;
}

export interface PlanDetail extends PlanRow {
  features: string[];
  legacyPlan: { id: string; name: string } | null;
  history: PlanVersion[];
}

export interface VersionedPlan extends PlanDetail {
  stripePending: boolean;
}

export interface PlanQuery {
  state?: PlanListState;
  family?: string;
  countryId?: string;
  search?: string;
}

export interface PlanTerms {
  name: string;
  countryId: string | null;
  currency: string;
  priceMonthly: number;
  priceAnnual: number;
  priceOnce: number | null;
  validityMonths: number | null;
  limits: PlanLimits;
}

export interface CreatePlanBody extends Omit<PlanTerms, 'countryId'> {
  code: string;
  family: string;
  kind: PlanKind;
  countryId?: string;
  visible: boolean;
  reason: string;
}

export type VersionPlanBody = Partial<Omit<PlanTerms, 'limits'>> & {
  limits?: Partial<PlanLimits>;
  reason: string;
};

export interface CountryOption {
  id: string;
  name: string;
}

export interface LegacyPlanChoice {
  id: string;
  name: string;
  costMonthly: number | null;
  documentsMonthly: number | null;
  plansLinked: string[];
}

export interface StripeLinkBody {
  monthly: string | null;
  annual: string | null;
  reason: string;
}

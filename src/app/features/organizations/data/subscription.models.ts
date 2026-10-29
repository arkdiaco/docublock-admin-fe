export type PlanResource = 'DOCUMENTS' | 'ID_BIOMETRIC' | 'ID_ANI' | 'ID_IDENTITY';

export interface PlanRef {
  id: string;
  code: string;
  name: string;
  version?: number;
}

export interface SubscriptionCounter {
  resource: PlanResource;
  limit: number | null;
  used: number;
  remaining: number | null;
}

export interface PlanLimits {
  documents: number | null;
  idBiometric: number | null;
  idAni: number | null;
  idIdentity: number | null;
}

export interface CatalogPlan {
  code: string;
  name: string;
  family: string;
  kind: string;
  validityMonths: number | null;
  limits: PlanLimits;
}

export interface SubscriptionView {
  current: {
    id: string;
    plan: PlanRef | null;
    source: string;
    periodStart: string;
    periodEnd: string | null;
    lapsed: boolean;
    counters: SubscriptionCounter[];
  } | null;
  history: {
    id: string;
    plan: PlanRef | null;
    state: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
    source: string;
    periodStart: string;
    periodEnd: string | null;
  }[];
  mirror: { documents?: number; remainingDocuments?: number; expiration?: string } | null;
  plans: CatalogPlan[];
  carriedOver?: number;
}

export interface AssignPlanBody {
  planCode: string;
  periodEnd?: string;
  noExpiry?: boolean;
  documents?: number;
  carry: boolean;
  reason: string;
}

export interface PeriodBody {
  periodEnd?: string;
  noExpiry?: boolean;
  reason: string;
}

export interface CounterBody {
  limit?: number | null;
  used?: number;
  reason: string;
}

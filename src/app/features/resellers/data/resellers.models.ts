export interface PageOf<T> {
  total: number;
  items: T[];
}

export interface Reseller {
  id: string;
  businessName: string;
  tributaryNumber: string;
  email?: string;
  active: boolean;
  isReseller: boolean;
  portfolioCount: number;
  createdAt?: string;
}

export interface PortfolioPlan {
  code: string | null;
  name: string | null;
  periodEnd: string | null;
  documents: { limit: number | null; used: number; remaining: number | null };
}

export interface PortfolioOrg {
  id: string;
  businessName: string;
  tributaryNumber: string;
  active: boolean;
  plan: PortfolioPlan | null;
  users: { total: number; active30d: number };
}

export type HistoryAction =
  | 'reseller.flag_set'
  | 'reseller.flag_removed'
  | 'organization.reseller_assigned'
  | 'organization.reseller_unassigned';

export interface HistoryEntry {
  id: string;
  userId: string;
  action: HistoryAction;
  organizationId: string;
  resellerId?: string;
  previousResellerId?: string;
  actorName?: string;
  organizationName?: string;
  resellerName?: string;
  previousResellerName?: string;
  createdAt?: string;
}

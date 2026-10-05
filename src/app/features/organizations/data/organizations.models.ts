export type PlatformOrgState = 'active' | 'suspended' | 'expired' | 'no_subscription';

export interface PlatformOrgRow {
  id: string;
  businessName: string;
  tributaryNumber: string;
  countryId?: string;
  countryName?: string;
  state: PlatformOrgState;
  plan?: { code: string; name: string };
  periodEnd?: string | null;
  source?: string;
  documents: { used: number; limit: number | null };
  members: number;
  warning: boolean;
  isReseller: boolean;
  createdAt?: string;
}

export interface PlatformStateCounts {
  total: number;
  active: number;
  suspended: number;
  expired: number;
  no_subscription: number;
}

export interface PlatformOrgPage {
  total: number;
  items: PlatformOrgRow[];
  counts: PlatformStateCounts;
}

export interface PlatformOrgQuery {
  page?: number;
  limit?: number;
  search?: string;
  state?: PlatformOrgState;
  countryId?: string;
  reseller?: boolean;
}

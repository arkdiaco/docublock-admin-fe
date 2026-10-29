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
  isTest?: boolean;
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

export interface PlatformOrgDetail {
  id: string;
  businessName: string;
  tributaryNumber: string;
  type: number;
  countryId?: string;
  countryName?: string;
  cityId?: string;
  cityName?: string;
  language?: string;
  phone?: string;
  email?: string;
  address?: string;
  webSite?: string;
  constitutionDate?: string;
  logo?: string;
  state: PlatformOrgState;
  suspendedAt?: string;
  isReseller: boolean;
  resellerId?: string;
  resellerName?: string;
  isTest: boolean;
  createdAt?: string;
  plan?: {
    code: string;
    name: string;
    source: string;
    periodStart: string;
    periodEnd: string | null;
  };
  documents: { used: number; limit: number | null };
  members: number;
  modules: string[];
}

export interface PlatformOrgUpdate {
  businessName?: string;
  tributaryNumber?: string;
  cityId?: string;
  phone?: string;
  address?: string;
  email?: string;
  webSite?: string;
  language?: string;
  constitutionDate?: string;
  isTest?: boolean;
  reason?: string;
}

export interface CityOption {
  id: string;
  name: string;
}

export interface ResellerOption {
  id: string;
  businessName: string;
  tributaryNumber: string;
}

export interface CountryOption {
  id: string;
  name: string;
}

export interface CreateOrganizationBody {
  businessName: string;
  tributaryNumber: string;
  type: number;
  countryId: string;
  cityId: string;
  phone: string;
  address: string;
  email: string;
  webSite?: string;
  language?: string;
  resellerId?: string;
  isTest: boolean;
  admin: { identification: string; email: string };
  reason: string;
}

export interface CreatedOrganization {
  id: string;
  businessName: string;
  invitation: { id: string; email: string; expiresAt: string } | null;
  invitationError: string | null;
}

export interface DocumentsBalance {
  limit: number | null;
  used: number;
  remaining: number | null;
}

export interface DocumentTransferResult {
  transferred: number;
  source: DocumentsBalance;
  target: DocumentsBalance;
}

export interface PageOf<T> {
  total: number;
  items: T[];
}

export type UserView = 'active' | 'inactive' | 'without';

export interface UserCounts {
  all: number;
  active: number;
  inactive: number;
  without: number;
}

export interface UsersPage extends PageOf<PlatformUser> {
  counts: UserCounts;
}

export interface PlatformUser {
  id: string;
  names: string;
  surNames: string;
  email: string;
  phone: string;
  identification: string;
  active: boolean;
  countryId?: string;
  countryName?: string;
  organizationsCount: number;
  createdAt?: string;
}

export interface UserMembership {
  membershipId?: string;
  duplicate: boolean;
  organizationId: string;
  organizationName?: string;
  tributaryNumber?: string;
  personal: boolean;
  roleId: string;
  roleCode?: number;
  roleName?: string;
  active: boolean;
  email: string;
  phone: string;
  branchType?: string;
}

export interface PlatformUserDetail extends PlatformUser {
  identificationType?: string;
  cityId?: string;
  cityName?: string;
  expeditionCityName?: string;
  expeditionDate?: string;
  termsAccepted: boolean;
  updatedAt?: string;
  memberships: UserMembership[];
}

export interface CountryOption {
  id: string;
  label: string;
}

export interface CityOption {
  id: string;
  name: string;
}

export interface OrganizationRole {
  id: string;
  name: string;
}

export interface UserChanges {
  names?: string;
  surNames?: string;
  email?: string;
  phone?: string;
  expeditionDate?: string;
  countryId?: string;
  cityId?: string;
}

export interface UserSession {
  sid: string;
  device?: string;
  ip?: string;
  lastUsedAt?: string;
  createdAt?: string;
}

export interface UserPasskey {
  credentialId: string;
  deviceName?: string;
  backedUp: boolean;
  createdAt?: string;
  lastUsedAt?: string;
}

export interface UserAccess {
  active: boolean;
  revokedSessions: number;
}

export interface UserHistoryEvent {
  id: string;
  action: string;
  admin: { id: string; email?: string; name?: string };
  organization?: { id: string; name?: string };
  reason?: string;
  createdAt?: string;
}

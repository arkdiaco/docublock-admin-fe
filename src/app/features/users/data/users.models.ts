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

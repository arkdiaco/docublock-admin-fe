export type LegalEntityView = 'active' | 'inactive';

export interface LegalEntityCounts {
  all: number;
  active: number;
  inactive: number;
  pending: number;
}

export interface LegalEntityRow {
  id: string;
  businessName: string;
  identification: string;
  countryId?: string;
  countryName?: string;
  active: boolean;
  representativesCount: number;
  legalRepName?: string;
  createdAt?: string;
}

export interface LegalEntityRepresentative {
  signerId: string;
  fullName: string;
  identification?: string;
  email?: string;
  isLegalRep: boolean;
  signerIsLegalRep: boolean;
  since?: string;
}

export interface LegalEntityDetail extends LegalEntityRow {
  kindPersonId?: string;
  kindPersonName?: string;
  companySignerId?: string;
  representatives: LegalEntityRepresentative[];
}

export interface LegalEntitiesPage {
  total: number;
  items: LegalEntityRow[];
  counts: LegalEntityCounts;
}

export interface PendingLegalEntity {
  signerId: string;
  businessName: string;
  identification: string;
  countryId?: string;
  countryName?: string;
  kindPersonId?: string;
  representativeIdentification?: string;
  representative?: { signerId: string; fullName: string };
}

export interface PendingLegalEntitiesPage {
  total: number;
  items: PendingLegalEntity[];
  counts: LegalEntityCounts;
}

export interface NewLegalEntity {
  businessName: string;
  identification: string;
  countryId?: string;
  kindPersonId?: string;
  representative?: { signerId: string; isLegalRep: boolean };
}

export interface LegalEntityChanges {
  businessName?: string;
  identification?: string;
  countryId?: string | null;
  kindPersonId?: string | null;
}

export interface CountryOption {
  id: string;
  label: string;
}

export interface KindOption {
  id: string;
  name: string;
}

export interface SignerOption {
  id: string;
  label: string;
}

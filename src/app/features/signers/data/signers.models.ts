export interface PageOf<T> {
  total: number;
  items: T[];
}

export type SignerView = 'identified' | 'unidentified' | 'without';

export interface SignerCounts {
  all: number;
  identified: number;
  unidentified: number;
  without: number;
}

export interface SignersPage extends PageOf<PlatformSigner> {
  counts: SignerCounts;
}

export interface PlatformSigner {
  id: string;
  fullName: string;
  businessName?: string;
  identification?: string;
  email?: string;
  cellphone?: string;
  countryId?: string;
  countryName?: string;
  identified: boolean;
  autoSign: boolean;
  oneTouch: boolean;
  organizationsCount: number;
  createdAt?: string;
}

export interface SignerOrganization {
  id: string;
  name?: string;
  tributaryNumber?: string;
}

export interface SignerAutoSign {
  enabledAt?: string;
  otpVerifiedAt?: string;
  otpChannels?: string[];
  ip?: string;
  browser?: string;
}

export interface PlatformSignerDetail extends PlatformSigner {
  firstName: string;
  lastName: string;
  personalMail?: string;
  kindPersonId?: string;
  kindPersonName?: string;
  identificationTypeId?: string;
  identificationTypeName?: string;
  expeditionCityId?: string;
  expeditionCityName?: string;
  expeditionDate?: string;
  birthDate?: string;
  isLegalRep: boolean;
  identityId?: string;
  autoSignAuth?: SignerAutoSign;
  organizations: SignerOrganization[];
}

export interface SignerChanges {
  firstName?: string;
  lastName?: string;
  businessName?: string | null;
  email?: string;
  personalMail?: string | null;
  cellphone?: string;
  countryId?: string;
  kindPersonId?: string;
  identificationTypeId?: string;
  expeditionCityId?: string | null;
  expeditionDate?: string | null;
  birthDate?: string | null;
}

export interface CountryOption {
  id: string;
  label: string;
}

export interface NamedOption {
  id: string;
  name: string;
}

export interface IdentificationTypeOption extends NamedOption {
  kindPersonId?: string;
}

export interface SignerPasskey {
  credentialId: string;
  deviceName?: string;
  backedUp: boolean;
  createdAt?: string;
  lastUsedAt?: string;
}

export interface SignerOneTouch {
  enabled: boolean;
  credentials: SignerPasskey[];
}

export interface SignerDocument {
  id: string;
  name: string;
  code?: string;
  organization: { id: string; businessName?: string };
  status: { state: number; progress: number };
  signer?: {
    identityId: string;
    checked: boolean;
    signedAt?: string;
    signingAttempts: number;
    blocked: boolean;
  };
}

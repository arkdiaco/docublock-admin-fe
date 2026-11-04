export interface CatalogPage<T> {
  total: number;
  items: T[];
}

export interface CountryOption {
  id: string;
  label: string;
}

export interface CountryRow {
  id: string;
  name: string;
  abbreviation: string;
  flag: string;
  callingCode: string;
  currency: string;
  locale: string;
  timezone: string;
  citiesCount: number;
  kindPersonsCount: number;
  identificationTypesCount: number;
}

export interface TaxIdRule {
  label?: string;
  example?: string;
  pattern?: string;
  normalize?: 'strip-dv';
}

export type CountryAddon = 'pagares' | 'bienes_raices';

export interface CountryCapabilities {
  companyRegistry: unknown;
  identityRegistry: { docTypes: string[] } | null;
  registryFaceMatch: unknown;
  idCardReader: unknown;
  sms: boolean;
  addons: CountryAddon[];
}

export interface CountryDetail extends CountryRow {
  resolution: string;
  taxId: TaxIdRule;
  capabilities: CountryCapabilities;
}

export interface CountryChanges {
  name?: string;
  abbreviation?: string;
  callingCode?: string | null;
  currency?: string | null;
  locale?: string | null;
  timezone?: string | null;
  resolution?: string | null;
  taxId?: TaxIdRule | null;
}

export interface CapabilitiesInput {
  companyRegistry: boolean;
  identityRegistry: boolean;
  docTypes: string[];
  registryFaceMatch: boolean;
  idCardReader: boolean;
  sms: boolean;
  addons: CountryAddon[];
}

export interface CityRow {
  id: string;
  name: string;
  code?: string;
  countryId: string;
  countryName?: string;
}

export interface CatalogLabels {
  es?: string;
  en?: string;
}

export type KindType = 'natural' | 'legal';

export interface KindPersonRow {
  id: string;
  name: string;
  type: KindType;
  labels?: CatalogLabels;
  countryId: string;
  countryName?: string;
  identificationTypesCount: number;
}

export interface IdentificationTypeRow {
  id: string;
  name: string;
  abbreviation: string;
  alphanumeric: boolean;
  labels?: CatalogLabels;
  kindPersonId: string;
  kindPersonName?: string;
  countryId: string;
  countryName?: string;
}

export const POLICY_FIELDS = [
  'businessName',
  'identificationTypeRepLegalId',
  'identificationRepLegal',
  'expeditionDate',
  'birthDate',
  'expeditionCityId',
  'personalMail',
] as const;

export type PolicyField = (typeof POLICY_FIELDS)[number];
export type FieldRule = 'required' | 'optional' | 'hidden';
export type DirectoryMode = 'OPEN' | 'ORG_ONLY';
export type FieldRules = Record<PolicyField, FieldRule>;

export interface SignerPolicy {
  countryId: string;
  directory: DirectoryMode;
  fields: {
    natural: { fields: FieldRules };
    legal: { fields: FieldRules };
  };
  customFields: boolean;
  customDirectory: boolean;
}

export const PROPERTY_CATEGORIES = [
  'propertyType',
  'kitchenType',
  'kitchenFloorType',
  'livingRoomType',
  'bedroomFloorType',
  'socialAreaFloorType',
  'otherFloorsType',
  'garageType',
  'consignmentType',
] as const;

export type PropertyCategory = (typeof PROPERTY_CATEGORIES)[number];

export interface PropertyItem {
  key: string;
  label: string;
}

export type PropertyCatalog = Record<PropertyCategory, PropertyItem[]>;

export type PolicyLocale = 'es' | 'en';

export interface ConsentPolicy {
  id: string;
  code: string;
  version: number;
  title: string;
  text: string;
  locale: string;
  publishedAt: string;
}

export interface ConsentDraft {
  code: string;
  title: string;
  text: string;
  locale: PolicyLocale;
}

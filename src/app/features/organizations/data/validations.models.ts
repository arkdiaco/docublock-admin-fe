export type ValidationKey = 'identityValid' | 'biometricValid' | 'ani' | 'liveness';

export const VALIDATION_KEYS: readonly ValidationKey[] = [
  'identityValid',
  'biometricValid',
  'ani',
  'liveness',
];

export type OrgOption = 'whatsapp' | 'skipVisualSign' | 'blockComments' | 'documentPhotos';

export type OrgOptionGroup = 'notices' | 'signing';

export const ORG_OPTION_GROUPS: readonly { key: OrgOptionGroup; options: readonly OrgOption[] }[] = [
  { key: 'notices', options: ['whatsapp'] },
  { key: 'signing', options: ['skipVisualSign', 'blockComments', 'documentPhotos'] },
];

export type SettingKey = ValidationKey | OrgOption;

export interface OrgSettings {
  validations: Record<ValidationKey, boolean>;
  selfService: Record<OrgOption, boolean>;
}

export type CreditType = 'biometric' | 'ani' | 'identity';

export const CREDIT_TYPES: readonly CreditType[] = ['identity', 'biometric', 'ani'];

export interface CreditBalance {
  unlimited: boolean;
  remaining: number;
}

export type OrgCredits = Record<CreditType, CreditBalance>;

export interface CreditChange {
  unlimited?: boolean;
  recharge?: number;
  remaining?: number;
}

export type PricedType = 'ani' | 'liveness' | 'macherFacial';

export const PRICED_TYPES: readonly PricedType[] = ['ani', 'liveness', 'macherFacial'];

export interface ValidationPricing {
  mode: 'package' | 'per_validation';
  currency: string;
  packagePrice: number;
  packageIncludes: PricedType[];
  unitPrices: Record<PricedType, number>;
  notes?: string;
  configured: boolean;
  updatedAt?: string;
}

export interface PricingBody {
  mode: 'package' | 'per_validation';
  currency: string;
  packagePrice: number;
  packageIncludes: PricedType[];
  unitPrices: Record<PricedType, number>;
  notes?: string;
  reason: string;
}

export interface CreditLogEntry {
  id: string;
  creditType: CreditType;
  action: 'recharge' | 'adjust' | 'set_unlimited' | 'consume';
  amount: number;
  previousRemaining?: number;
  newRemaining?: number;
  unlimited?: boolean;
  createdAt?: string;
}

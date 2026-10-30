import type { PriceTier } from '../../../shared/domain/price-tiers';

export interface OrgProductPrice {
  productCode: string;
  kind: 'VALIDATION_PACKAGE' | 'ADDON';
  name: string;
  currency: string;
  generalUnitPrice: number;
  unitPrice: number;
  tiers: PriceTier[];
  taxPct: number;
  overridden: boolean;
  note?: string;
  updatedAt?: string;
}

export type OrgAddonState = 'ACTIVE' | 'PENDING' | 'INACTIVE';

export interface OrgAddon {
  code: string;
  addonCode: string;
  name: string;
  unitPrice: number;
  taxPct: number;
  state: OrgAddonState;
  source?: 'STRIPE' | 'PLATFORM';
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  onSale: boolean;
}

export interface OverrideBody {
  unitPrice: number;
  tiers?: PriceTier[];
  taxPct?: number;
  note?: string;
  reason: string;
}

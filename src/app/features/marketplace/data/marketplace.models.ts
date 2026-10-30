import type { PriceTier } from '../../../shared/domain/price-tiers';

export const PRODUCT_KINDS = ['VALIDATION_PACKAGE', 'ADDON'] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const CREDIT_TYPES = ['ani', 'identity', 'biometric'] as const;
export type CreditType = (typeof CREDIT_TYPES)[number];

export const ADDON_CODES = ['pagares', 'consentimiento_informado', 'bienes_raices'] as const;
export type AddonCode = (typeof ADDON_CODES)[number];

export const STORE_DETAIL_CODES: readonly string[] = ['VAL_ANI', 'VAL_IDENTITY', 'VAL_BIOMETRIC'];
export const STORE_ADDON_CHANGES: readonly string[] = ['pagares', 'consentimiento_informado'];

export type ProductListState = 'active' | 'retired' | 'all';
export type ProductState = 'ACTIVE' | 'RETIRED';

export interface ProductQuery {
  state: ProductListState;
  kind?: ProductKind;
  currency?: string;
  search?: string;
}

export interface ProductRow {
  code: string;
  kind: ProductKind;
  creditType?: CreditType;
  addonCode?: AddonCode;
  level?: number;
  name: string;
  currency: string;
  state: ProductState;
  version: number;
  versions: number;
  unitPrice: number;
  fromPrice: number;
  taxPct: number;
  visible: boolean;
  activeAddons: number;
  overrides: number;
  paidOrders30d: number;
}

export interface ProductVersion {
  id: string;
  version: number;
  state: ProductState;
  unitPrice: number;
  tiers: PriceTier[];
  minQuantity: number;
  taxPct: number;
  createdAt?: string;
}

export interface ProductTexts {
  name: string;
  summary: string;
  bullets: string[];
  limitations: string;
}

export interface ProductDetail extends ProductRow, ProductTexts {
  tiers: PriceTier[];
  minQuantity: number;
  history: ProductVersion[];
}

export interface CreateProductBody extends ProductTexts {
  code: string;
  kind: ProductKind;
  creditType?: CreditType;
  level?: number;
  addonCode?: AddonCode;
  currency: string;
  unitPrice: number;
  tiers: PriceTier[];
  minQuantity: number;
  taxPct: number;
  visible: boolean;
  reason: string;
}

export interface VersionProductBody {
  unitPrice?: number;
  tiers?: PriceTier[];
  minQuantity?: number;
  taxPct?: number;
  reason: string;
}

export interface CurrencyCountry {
  id: string;
  name: string;
  currency: string;
}

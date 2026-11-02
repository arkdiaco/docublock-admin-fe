export interface PromoCode {
  id: string;
  name: string;
  code: string;
  discount: number;
  quantity: number;
  redeemed: number;
  remaining: number;
  available: boolean;
  countryId?: string;
  active: boolean;
  expiresAt?: string;
  createdAt?: string;
}

export interface ListQuery {
  search?: string;
  active?: boolean;
  page?: number;
  limit?: number;
}

export interface PageOf<T> {
  total: number;
  items: T[];
}

export interface CreatePromoBody {
  name: string;
  code: string;
  discount: number;
  quantity: number;
  countryId?: string;
  expiresAt?: string;
}

export interface UpdatePromoBody {
  name?: string;
  discount?: number;
  quantity?: number;
  countryId?: string | null;
  active?: boolean;
  expiresAt?: string | null;
}

export interface Redemption {
  id: string;
  discount: number;
  organizationId?: string;
  organizationName?: string;
  reference?: string;
  releasedAt?: string;
  createdAt?: string;
}

export interface ReportItem {
  kind: 'MARKETPLACE' | 'PLAN';
  reference: string;
  organizationId: string;
  organizationName: string;
  date: string;
  quantity?: number;
  promoDiscount: number;
  paid: number;
  currency: string;
}

export interface CurrencyTotals {
  currency: string;
  marketplace: { orders: number; promoDiscount: number; total: number };
  plans: { transactions: number; amount: number; discount: number };
  total: number;
}

export interface PromoReport {
  referrer: { id: string; name: string } | null;
  redemptions: { total: number; released: number; effective: number };
  totals: CurrencyTotals[];
  items: ReportItem[];
}

export interface ReportRange {
  from: string;
  to: string;
}

export type ReferralCode = Pick<
  PromoCode,
  | 'id'
  | 'code'
  | 'name'
  | 'discount'
  | 'quantity'
  | 'redeemed'
  | 'remaining'
  | 'active'
  | 'available'
  | 'expiresAt'
>;

export interface Referral {
  id: string;
  name: string;
  email: string;
  phone?: string;
  document?: string;
  notes?: string;
  promotionalCodeId: string;
  active: boolean;
  createdAt?: string;
  code: ReferralCode;
}

export interface CreateReferralBody {
  name: string;
  email: string;
  phone?: string;
  document?: string;
  notes?: string;
  code?: Omit<CreatePromoBody, 'name'>;
  promotionalCodeId?: string;
}

export interface UpdateReferralBody {
  name?: string;
  email?: string;
  phone?: string | null;
  document?: string | null;
  notes?: string | null;
  active?: boolean;
}

export interface CountryOption {
  id: string;
  name: string;
}

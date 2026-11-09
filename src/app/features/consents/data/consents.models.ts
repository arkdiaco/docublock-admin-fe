export type ConsentSource = 'catalog' | 'legacy';

export interface ConsentItem {
  documentId: string;
  documentName: string;
  documentCode?: string;
  organization: { id: string; name?: string };
  signer: { identityId: string; signerId?: string; name: string; identification?: string };
  acceptedAt: string;
  source: ConsentSource;
  policy: { id?: string; code?: string; version?: number; title?: string; legacyVersion?: string };
  ip?: string;
}

export interface ConsentPolicyOption {
  value: string;
  code: string;
  version: number;
  title?: string;
  count: number;
}

export interface ConsentReport {
  total: number;
  signers: number;
  organizations: number;
  page: number;
  limit: number;
  exportCap: number;
  items: ConsentItem[];
  policies: { catalog: ConsentPolicyOption[]; legacy: number };
}

export interface ConsentFilters {
  from: string | null;
  to: string | null;
  organizationId: string | null;
  policy: string;
  search: string;
  page: number;
}

export interface ConsentRequest {
  from?: string;
  to?: string;
  organizationId?: string;
  policy?: string;
  search?: string;
  tz: string;
}

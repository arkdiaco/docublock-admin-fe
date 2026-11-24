export type InactivePlanState = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export interface InactiveOrganizationRow {
  organization: {
    id: string;
    businessName: string;
    tributaryNumber: string;
    email: string | null;
    suspended: boolean;
  };
  lastActivityAt: string;
  lastDocumentAt: string | null;
  lastSignatureAt: string | null;
  documents: number;
  signedDocuments: number;
  monthsInactive: number;
  plan: { code: string; name: string; state: InactivePlanState; periodEnd: string | null } | null;
}

export interface InactiveOrganizationsPage {
  months: number;
  cutoff: string;
  computedAt: string | null;
  total: number;
  items: InactiveOrganizationRow[];
}

export interface InactiveOrganizationsQuery {
  search?: string;
  page: number;
  limit: number;
}

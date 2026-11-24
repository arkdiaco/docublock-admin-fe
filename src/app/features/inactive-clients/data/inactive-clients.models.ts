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

export type InactiveExportState = 'running' | 'done' | 'failed';
export type OmittedReason = 'MUY_GRANDE' | 'NO_DISPONIBLE';

export interface InactiveExportPart {
  index: number;
  bytes: number;
  documents: number;
}

export interface OmittedDocument {
  id: string;
  code: string | null;
  name: string;
  reason: OmittedReason;
}

export interface InactiveExportView {
  id: string;
  state: InactiveExportState;
  total: number;
  processed: number;
  parts: InactiveExportPart[];
  omitted: OmittedDocument[];
  createdAt: string;
  finishedAt: string | null;
  expiresAt: string | null;
  expired: boolean;
  url: string | null;
  error: string | null;
}

export interface SignedDocumentItem {
  documentId: string;
  name: string;
  code?: string;
  organization: { id: string; name: string };
  signers: number;
  signed: number;
  signedAt: string;
}

export interface SignedDocumentsReport {
  reseller: { id: string; businessName: string };
  total: number;
  organizations: number;
  organizationsWithSigned: number;
  byOrganization: { organizationId: string; businessName: string; count: number }[];
  page: number;
  limit: number;
  exportCap: number;
  items: SignedDocumentItem[];
}

export interface SignedDocumentsFilters {
  resellerId: string | null;
  from: string | null;
  to: string | null;
  page: number;
}

export interface SignedDocumentsRequest {
  from?: string;
  to?: string;
  tz: string;
}

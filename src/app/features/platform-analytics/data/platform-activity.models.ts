import type {
  SeriesGranularity,
  SignatureChannel,
  SignaturesRequest,
} from './platform-signatures.models';

export interface DocumentTotals {
  created: number;
  completed: number;
  averageCompletionMs: number | null;
}

export interface DocumentCohort {
  completed: number;
  inProgress: number;
  rejected: number;
  cancelled: number;
}

export interface DocumentBucket {
  bucket: string;
  created: number;
  completed: number;
}

export interface PlatformDocuments {
  from: string;
  to: string;
  timeZone: string;
  granularity: SeriesGranularity;
  organizationId: string | null;
  channel: SignatureChannel;
  totals: DocumentTotals;
  cohort: DocumentCohort;
  previous: DocumentTotals & { from: string; to: string };
  series: DocumentBucket[];
}

export interface TopOrganization {
  organizationId: string;
  businessName: string;
  tributaryNumber: string;
  signatures: number;
  documents: number;
  people: number;
}

export interface PlatformOrganizationActivity {
  from: string;
  to: string;
  timeZone: string;
  channel: SignatureChannel;
  active: number;
  previous: { from: string; to: string; active: number };
  top: TopOrganization[];
}

export type DocumentsRequest = SignaturesRequest;
export type OrganizationsRequest = Omit<SignaturesRequest, 'organizationId'>;

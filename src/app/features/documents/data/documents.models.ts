export type SignatureProgress = 0 | 1 | 2 | 3;

export type DocumentState = 0 | 1 | 4 | 5;

export type BlockchainFilter = 'registered' | 'pending';

export type RetryableEvidence = 'liveness' | 'faceCompare' | 'faceMatch' | 'documentCheck';

export const RETRYABLE_EVIDENCE: readonly RetryableEvidence[] = [
  'liveness',
  'faceCompare',
  'faceMatch',
  'documentCheck',
];

export interface DocumentStatus {
  progress: SignatureProgress;
  state: DocumentState;
  label: string;
}

export interface PlatformDocumentSummary {
  id: string;
  name: string;
  code?: string;
  kind: string;
  portal?: string;
  organization: { id: string; businessName?: string };
  owner?: { id: string; names?: string; email?: string };
  status: DocumentStatus;
  signedCount: number;
  signerCount: number;
  blockchainUrl?: string;
  anchored: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DocumentsPage {
  total: number;
  items: PlatformDocumentSummary[];
}

export interface DocumentsQuery {
  search?: string;
  organization?: string;
  state?: DocumentState;
  progress?: SignatureProgress[];
  blockchain?: BlockchainFilter;
  page?: number;
  limit?: number;
}

export interface IssueBucket {
  total: number;
  documents: PlatformDocumentSummary[];
}

export interface DocumentIssues {
  unregisteredBlockchain: IssueBucket;
  stuckCompleted: IssueBucket;
}

export interface PlatformSigner {
  identityId: string;
  name: string;
  email?: string;
  identification?: string;
  order: number;
  role: string;
  checked: boolean;
  signedAt?: string;
  signingAttempts: number;
  blocked: boolean;
  evidence?: Record<string, unknown>;
}

export interface VersionComment {
  signerId: string;
  userId?: string;
  comment: string;
  date?: string;
}

export interface DocumentVersion {
  id: string;
  index: number;
  checksum?: string;
  signatureProgress?: string;
  createdAt?: string;
  comments?: VersionComment[];
}

export interface DocumentAnchor {
  ledger: string;
  commitmentHash: string;
  blockNumber?: number;
  url?: string;
  anchoredAt: string;
}

export interface DocumentCertificate {
  sha256: string;
  issuedAt: string;
}

export interface DocumentTurn {
  order: number;
  onHold: boolean;
  pending: number;
}

export interface ReminderRule {
  everyHours: number;
  max: number;
}

export interface SigningPolicy {
  deadline?: string;
  reminders?: ReminderRule;
  maxAttempts?: number;
}

export interface DocumentField {
  name: string;
  value: string;
}

export interface IntegrationAttachment {
  index: number;
  name: string;
  merge: boolean;
  available: boolean;
}

export interface LinkedRef {
  id: string;
  name?: string;
  code?: string;
}

export interface LinkedBlock extends LinkedRef {
  signatureMode?: string;
  documents: number;
}

export interface LinkedFlow {
  processId?: string;
  processName?: string;
  flowId?: string;
  flowName?: string;
}

export interface PlatformDocumentDetail extends PlatformDocumentSummary {
  signers: PlatformSigner[];
  versions: DocumentVersion[];
  anchor?: DocumentAnchor;
  certificate?: DocumentCertificate;
  turn: DocumentTurn;
  signing?: SigningPolicy;
  quotaConsumedAt?: string;
  fields: DocumentField[];
  relatedInfo?: Record<string, unknown>;
  attachments: IntegrationAttachment[];
  principalFolder: boolean;
  template?: LinkedRef;
  sourceTemplates: LinkedRef[];
  directory?: LinkedRef;
  folder?: LinkedRef;
  block?: LinkedBlock;
  flow?: LinkedFlow;
}

export type HiddenReason = 'secret' | 'html' | 'signers';

export interface HiddenField {
  path: string;
  reason: HiddenReason;
}

export interface RawDocument {
  id: string;
  data: unknown;
  hidden: HiddenField[];
}

export interface TraceActor {
  type: 'system' | 'user' | 'signer';
  id?: string;
  name?: string;
  email?: string;
  ip?: string;
}

export interface TraceEvent {
  type: string;
  timestamp: string;
  actor: TraceActor;
  details?: Record<string, unknown>;
}

export interface DocumentTrace {
  documentId: string;
  total: number;
  events: TraceEvent[];
}

export interface BlockchainRegistration {
  outcome: string;
  already?: boolean;
  anchorId?: string | null;
  lastError?: string | null;
}

export interface InvitationOutcome {
  sent: boolean;
  email: string | null;
}

export type BulkStatus = 'ok' | 'skipped' | 'error';

export interface BulkRegenerationResult {
  processed: number;
  ok: number;
  skipped: number;
  failed: number;
  results: { id: string; code?: string; name?: string; status: BulkStatus; message?: string }[];
}

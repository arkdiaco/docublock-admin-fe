export type SignatureProgress = 0 | 1 | 2 | 3;

export type DocumentState = 0 | 1 | 4 | 5;

export type BlockchainFilter = 'registered' | 'pending';

export type ReactivationScope = 'biometric' | 'document' | 'registry';

export const REACTIVATION_SCOPES: readonly ReactivationScope[] = [
  'biometric',
  'document',
  'registry',
];

export type ReactivationChoice = ReactivationScope | 'all';

export type EditBlock = 'DOCUMENTO_NO_PENDIENTE' | 'FIRMANTE_YA_FIRMO' | 'FIRMA_RETENIDA';

export type SignerFeature =
  | 'identityValid'
  | 'biometricValid'
  | 'checkDataRegistry'
  | 'fullIdentity'
  | 'reqDocument'
  | 'skipEmail';

export type AttachmentChangeKind = 'remove' | 'optional';

export interface AttachmentChange {
  index: number;
  name: string;
  change: AttachmentChangeKind;
}

export type SignerChange = Partial<Record<SignerFeature, boolean>> & {
  attachments?: AttachmentChange[];
};

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

export type SignerType = 'mandatory' | 'guarantor' | 'legalRep';

export type PhotoMode = 'none' | 'holding' | 'document';

export type EvidenceKind =
  'selfie' | 'documentFront' | 'documentBack' | 'photoFront' | 'photoBack' | 'signature';

export type SignerFileKind = EvidenceKind | 'identityDocument';

export type AttemptKind = 'biometric' | 'document' | 'liveness';

export type RetryKind = 'biometric' | 'document';

export type ApprovalItem = 'sign' | 'photoFront' | 'photoBack' | 'documentFront' | 'documentBack';

export type SignatureMethod = 'otp' | 'passkey' | 'auto' | 'propagated' | 'unknown';

export type LinkState = 'active' | 'expired' | 'revoked' | 'none';

export interface PersonRef {
  id: string;
  name?: string;
}

export interface SignerRequirements {
  identityValid: boolean;
  biometricValid: boolean;
  liveness: boolean;
  checkDataRegistry: boolean;
  fullIdentity: boolean;
  reqDocument: boolean;
  skipEmail: boolean;
  fillsForms: boolean;
  photoMode?: PhotoMode;
}

export interface IdentityCheck {
  variant?: string;
  verifiedAt?: string;
  ip?: string;
  userAgent?: string;
  fingerprint?: string;
}

export interface SignerIdentity {
  check?: IdentityCheck;
  validated?: boolean;
  blockedAt?: string;
  maxAttempts?: number;
}

export interface SignerConsent {
  policy: string;
  code: string;
  version: number;
  textHash: string;
  acceptedAt: string;
  ip?: string;
  userAgent?: string;
  fingerprint?: string;
}

export interface ProviderResponse {
  type?: string;
  date?: string;
  data: Record<string, unknown>;
}

export interface LivenessCheck {
  sessionId?: string;
  passed?: boolean;
  confidence?: number;
  threshold?: number;
  at?: string;
}

export interface FaceMatchCheck {
  passed?: boolean;
  code?: string;
  fallback: boolean;
  at?: string;
}

export interface FaceCompareCheck {
  passed?: boolean;
  score?: number;
  threshold?: number;
  at?: string;
}

export interface DocumentCheck {
  passed?: boolean;
  unreadable: boolean;
  skipped?: string;
  documentNumber?: string;
  at?: string;
}

export interface RegistryCheck {
  ok?: boolean;
  code?: string;
  checkedAt?: string;
}

export interface SignerChecks {
  liveness?: LivenessCheck;
  faceMatch?: FaceMatchCheck;
  faceCompare?: FaceCompareCheck;
  documentCheck?: DocumentCheck;
  documentReadTries?: number;
  registry?: RegistryCheck;
  providerResponses: ProviderResponse[];
}

export interface AttemptWindow {
  used: number;
  max: number;
  retryAfterSeconds?: number;
}

export interface RetryCounter {
  granted: number;
  max: number;
}

export interface SignerAttempts {
  window: Record<AttemptKind, AttemptWindow>;
  counted: Partial<Record<RetryKind, number>>;
  retries: Record<RetryKind, RetryCounter>;
  reactivations: Record<ReactivationScope, number>;
  credits: { biometric: boolean; identity: boolean };
}

export interface SignerFile {
  kind: SignerFileKind;
  legacy: boolean;
  mime?: string;
  size?: number;
  sha256?: string;
  at?: string;
}

export interface ApprovalDecision {
  status?: string;
  requestedAt?: string;
  decidedAt?: string;
  decidedBy?: PersonRef;
  comment?: string;
  items?: Partial<Record<ApprovalItem, boolean>>;
}

export interface SignerApproval extends ApprovalDecision {
  held: boolean;
  heldSince?: string;
}

export interface LegacyApprovalComment {
  by?: PersonRef;
  comment?: string;
  at?: string;
}

export interface LegacyApproval {
  sign?: boolean;
  photoFront?: boolean;
  photoBack?: boolean;
  comments: LegacyApprovalComment[];
}

export interface EvidenceHistoryEntry {
  index: number;
  rejectedAt?: string;
  reactivatedAt?: string;
  scopes?: ReactivationScope[];
  approval?: ApprovalDecision;
  registry?: RegistryCheck;
  files: EvidenceKind[];
}

export interface SignerLocation {
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  provider?: string;
  at?: string;
}

export interface VaultSeal {
  recordId?: string;
  bundleHash?: string;
  keyId?: string;
  algorithm?: string;
  signedAt?: string;
  legacy?: string;
}

export interface SignerSignature {
  signedAt?: string;
  method: SignatureMethod;
  otpChannels: string[];
  otpVerifiedAt?: string;
  propagatedFrom?: string;
  ip?: string;
  browser?: string;
  origin?: string;
  fingerprint?: string;
  location?: SignerLocation;
  signSha?: string;
  vault?: VaultSeal;
}

export interface SignerReport {
  issuedAt?: string;
  sha256?: string;
  available: boolean;
}

export interface RequestedAttachment {
  index: number;
  name: string;
  info: string;
  required: boolean;
  includeInDocument: boolean;
  provided: boolean;
  file?: { originalName: string; mime: string; size: number; sha256: string; at?: string };
  rejection?: { reason: string; at?: string };
}

export interface SignerNotices {
  notifiedAt?: string;
  remindersSent: number;
  lastReminderAt?: string;
  lastOpenedAt?: string;
  ownerLinkExpiredAt?: string;
  ownerUnresponsiveAt?: string;
}

export interface SignerLink {
  state: LinkState;
  issued: number;
  lastIssuedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
}

export interface PlatformSigner {
  identityId: string;
  signerId?: string;
  name: string;
  email?: string;
  identification?: string;
  order: number;
  role: string;
  checked: boolean;
  signedAt?: string;
  signingAttempts: number;
  blocked: boolean;
  type: SignerType;
  principal: boolean;
  legalRep: boolean;
  requirements: SignerRequirements;
  identity: SignerIdentity;
  consents: SignerConsent[];
  checks: SignerChecks;
  attempts: SignerAttempts;
  files: SignerFile[];
  history: EvidenceHistoryEntry[];
  signature?: SignerSignature;
  approval?: SignerApproval;
  legacyApproval?: LegacyApproval;
  report?: SignerReport;
  attachments: RequestedAttachment[];
  notices: SignerNotices;
  link: SignerLink;
  editBlock?: EditBlock;
  reactivationScopes: ReactivationScope[];
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

export interface RegistryCredits {
  unlimited: boolean;
  remaining: number;
}

export interface EnabledValidations {
  identityValid: boolean;
  biometricValid: boolean;
  checkDataRegistry: boolean;
  registryCredits?: RegistryCredits;
}

export interface PlatformDocumentDetail extends PlatformDocumentSummary {
  enabledValidations: EnabledValidations;
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

export type HiddenReason = 'secret' | 'html' | 'signers' | 'files';

export interface HiddenField {
  path: string;
  reason: HiddenReason;
}

export interface RawDocument {
  id: string;
  data: unknown;
  hidden: HiddenField[];
}

export interface RawSigner extends RawDocument {
  identityId: string;
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

export interface ReactivationOutcome {
  identityId: string;
  scopes: ReactivationScope[];
  reactivations: Record<ReactivationScope, number>;
  registry?: RegistryCheck;
}

export interface SignerChangeOutcome {
  identityId: string;
  changed: SignerFeature[];
  attachments: { removed: number; optional: number };
  registry?: RegistryCheck;
}

export type BulkStatus = 'ok' | 'skipped' | 'error';

export interface BulkRegenerationResult {
  processed: number;
  ok: number;
  skipped: number;
  failed: number;
  results: { id: string; code?: string; name?: string; status: BulkStatus; message?: string }[];
}

import type { OrgState } from '../../../shared/domain/org-state';
import type {
  ApprovalItem,
  AttemptKind,
  LinkState,
  PlatformDocumentDetail,
  PlatformSigner,
  SignerFile,
  SignerFileKind,
  SignerLocation,
  SignerRequirements,
} from './documents.models';
import { inOpenTurn } from './document-view';

export type SignerState = 'blocked' | 'approval' | 'turn' | 'enabled';

export type CheckState = 'passed' | 'failed' | 'waiting';

export const SIGNER_STATE_FAMILY: Readonly<Record<SignerState, OrgState>> = {
  blocked: 'suspended',
  approval: 'trial',
  turn: 'warning',
  enabled: 'active',
};

export const SIGNER_STATE_LABEL: Readonly<Record<SignerState, string>> = {
  blocked: 'docs.signer.blocked',
  approval: 'docs.signer.approval',
  turn: 'docs.signer.inTurn',
  enabled: 'docs.signer.enabled',
};

export const awaitsApproval = (signer: PlatformSigner): boolean =>
  signer.approval?.status === 'pending';

export const signerStateOf = (doc: PlatformDocumentDetail, signer: PlatformSigner): SignerState => {
  if (signer.blocked) return 'blocked';
  if (awaitsApproval(signer)) return 'approval';
  return inOpenTurn(doc, signer) ? 'turn' : 'enabled';
};

export const CHECK_FAMILY: Readonly<Record<CheckState, OrgState>> = {
  passed: 'active',
  failed: 'suspended',
  waiting: 'trial',
};

export const checkOf = (passed?: boolean): CheckState =>
  passed === true ? 'passed' : passed === false ? 'failed' : 'waiting';

export const scoreText = (value?: number, threshold?: number): string => {
  if (value === undefined) return '—';
  return threshold === undefined ? String(value) : `${value} / ${threshold}`;
};

export const REQUIREMENT_KEYS = [
  'identityValid',
  'biometricValid',
  'liveness',
  'checkDataRegistry',
  'reqDocument',
  'fillsForms',
] as const satisfies readonly (keyof SignerRequirements)[];

export const ATTEMPT_KINDS: readonly AttemptKind[] = ['liveness', 'document', 'biometric'];

export const APPROVAL_ITEMS: readonly ApprovalItem[] = [
  'sign',
  'photoFront',
  'photoBack',
  'documentFront',
  'documentBack',
];

export interface ItemDecision {
  item: ApprovalItem;
  approved: boolean;
}

export const itemDecisionsOf = (
  items: Partial<Record<ApprovalItem, boolean>> | undefined,
): ItemDecision[] =>
  APPROVAL_ITEMS.flatMap((item) =>
    typeof items?.[item] === 'boolean' ? [{ item, approved: items?.[item] === true }] : [],
  );

export const APPROVAL_FAMILY: Readonly<Record<string, OrgState>> = {
  pending: 'trial',
  approved: 'active',
  rejected: 'suspended',
};

export const approvalFamilyOf = (status?: string): OrgState =>
  (status && APPROVAL_FAMILY[status]) || 'closed';

export const approvalStatusKey = (status?: string): string | null =>
  status && status in APPROVAL_FAMILY ? `docs.sp.approval.status.${status}` : null;

export const LINK_FAMILY: Readonly<Record<LinkState, OrgState>> = {
  active: 'active',
  expired: 'warning',
  revoked: 'suspended',
  none: 'closed',
};

const OTP_CHANNELS = ['email', 'sms', 'whatsapp'] as const;

export const otpChannelKey = (channel: string): string | null =>
  (OTP_CHANNELS as readonly string[]).includes(channel) ? `docs.sp.channel.${channel}` : null;

const SKIP_REASONS = ['no_reader'] as const;

export const skipReasonKey = (reason?: string): string | null =>
  reason && (SKIP_REASONS as readonly string[]).includes(reason)
    ? `docs.sp.doc.skip.${reason}`
    : null;

export const locationText = (location?: SignerLocation): string => {
  if (!location) return '—';
  const place = [location.city, location.region, location.country]
    .filter((part) => !!part)
    .join(', ');
  return place || location.countryCode || '—';
};

const KB = 1024;
const MB = KB * 1024;

export const sizeText = (bytes?: number): string => {
  if (bytes === undefined || bytes <= 0) return '';
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= KB) return `${Math.round(bytes / KB)} KB`;
  return `${bytes} B`;
};

export const fileMetaOf = (file: SignerFile): string =>
  [file.mime, sizeText(file.size)].filter((part) => !!part).join(' · ');

export type SignerPanelRequest =
  | { kind: 'file'; key: string; file: SignerFileKind; history?: number }
  | { kind: 'attachment'; key: string; index: number }
  | { kind: 'report'; key: string }
  | { kind: 'raw' };

export const panelKeyOf = (identityId: string, part: string): string => `sp:${identityId}:${part}`;

export const filePartOf = (kind: SignerFileKind, history?: number): string =>
  history === undefined ? `file:${kind}` : `file:${kind}:${history}`;

export const prettyJson = (value: unknown): string => JSON.stringify(value, null, 2);

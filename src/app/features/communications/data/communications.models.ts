export type RecipientKind = 'user' | 'signer';
export type RecipientSource = RecipientKind | 'number';

export interface RecipientRow {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  phoneIssue?: string;
}

export interface RecipientsPage {
  items: RecipientRow[];
  total: number;
}

export interface CustomNumber {
  phone: string;
  name?: string;
}

export interface RecipientsSelection {
  userIds: string[];
  signerIds: string[];
  numbers: CustomNumber[];
}

export interface SendableRecipient {
  source: RecipientSource;
  sourceId?: string;
  phone: string;
  name: string;
}

export interface ExcludedRecipient {
  source: RecipientSource;
  sourceId?: string;
  rawPhone?: string;
  name?: string;
  reason: string;
}

export interface RecipientsPreview {
  sendable: SendableRecipient[];
  excluded: ExcludedRecipient[];
  duplicates: number;
}

export interface CampaignImage {
  id: string;
  url: string;
}

export interface PickedImage extends CampaignImage {
  localUrl: string;
}

export interface NewCampaign extends RecipientsSelection {
  text: string;
  imageUrl: string;
  reason: string;
}

export interface CampaignCounts {
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  excluded: number;
  total: number;
}

export interface CampaignView {
  id: string;
  state: 'queued' | 'sending' | 'finished';
  text: string;
  imageUrl: string;
  reason: string;
  duplicates: number;
  retries: number;
  createdAt?: string;
  finishedAt?: string;
  createdByName?: string;
  counts: CampaignCounts;
}

export interface CampaignsPage {
  items: CampaignView[];
  total: number;
}

export interface CampaignFailure {
  code: string;
  total: number;
}

export interface CampaignDetail extends CampaignView {
  failures: CampaignFailure[];
}

export type CampaignRecipientState = 'pending' | 'sending' | 'sent' | 'failed' | 'excluded';

export interface CampaignRecipient {
  id: string;
  state: CampaignRecipientState;
  source: RecipientSource;
  phone?: string;
  rawPhone?: string;
  name?: string;
  reason?: string;
  error?: string;
  messageId?: string;
  attemptedAt?: string;
}

export interface CampaignRecipientsPage {
  items: CampaignRecipient[];
  total: number;
}

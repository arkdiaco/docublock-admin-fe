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
  defaultName?: string;
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

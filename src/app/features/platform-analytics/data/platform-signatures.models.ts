export type SignatureChannel = 'all' | 'platform' | 'integration';
export type SeriesGranularity = 'day' | 'week' | 'month';

export interface SignatureTotals {
  signatures: number;
  people: number;
  newPeople: number;
  documents: number;
  organizations: number;
}

export interface SignatureBucket {
  bucket: string;
  signatures: number;
  people: number;
}

export interface SignatureBreakdown {
  origin: { platform: number; integration: number; other: number };
  mode: { manual: number; automatic: number };
  legalRep: number;
  otp: { email: number; sms: number; whatsapp: number; passkey: number; none: number };
  identity: { biometric: number; registry: number; none: number };
}

export interface PlatformSignatures {
  from: string;
  to: string;
  timeZone: string;
  granularity: SeriesGranularity;
  organizationId: string | null;
  channel: SignatureChannel;
  totals: SignatureTotals;
  previous: SignatureTotals & { from: string; to: string };
  series: SignatureBucket[];
  breakdown: SignatureBreakdown;
}

export interface SignaturesRequest {
  from?: string;
  to?: string;
  tz: string;
  organizationId?: string;
  channel: SignatureChannel;
}

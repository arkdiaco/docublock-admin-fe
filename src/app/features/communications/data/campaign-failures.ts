import type { CampaignFailure } from './communications.models';

const KNOWN_FAILURES: readonly string[] = [
  'WHATSAPP_PROVIDER_FAILED',
  'WHATSAPP_NOT_CONFIGURED',
  'WHATSAPP_SIN_DESTINATARIO',
  'BLOCKED_URL',
  'ENVIO_INTERRUMPIDO',
  'ENVIO_FALLIDO',
  'COMMONS_SIN_RESPUESTA',
  'COMMONS_ERROR',
];

const CERTAIN_REJECTIONS: readonly string[] = [
  'WHATSAPP_PROVIDER_FAILED',
  'WHATSAPP_NOT_CONFIGURED',
  'WHATSAPP_SIN_DESTINATARIO',
  'BLOCKED_URL',
];

export const failureKey = (code: string): string =>
  KNOWN_FAILURES.includes(code) ? `comm.failure.${code}` : 'comm.failure.other';

export const mayHaveBeenSent = (code: string): boolean =>
  !CERTAIN_REJECTIONS.includes(code) && !/^COMMONS_4\d\d$/.test(code);

export const uncertainTotal = (failures: readonly CampaignFailure[]): number =>
  failures.filter((failure) => mayHaveBeenSent(failure.code)).reduce((sum, failure) => sum + failure.total, 0);

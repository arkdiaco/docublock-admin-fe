import type { TicketDetail } from './support.models';

export const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

export type WhatsappChatTarget = 'signer' | 'owner';

export interface WhatsappChatView {
  phone: string;
  to: WhatsappChatTarget;
  open: boolean;
  closesAt: string;
}

const TARGETS: readonly WhatsappChatTarget[] = ['signer', 'owner'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const whatsappChatOf = (
  ticket: Pick<TicketDetail, 'createdByType' | 'metadata'>,
  now: Date,
): WhatsappChatView | null => {
  const raw = ticket.createdByType === 'system' ? ticket.metadata?.['whatsappChat'] : null;
  if (!isRecord(raw) || typeof raw['phone'] !== 'string') return null;
  const to = TARGETS.find((target) => target === raw['to']);
  const last = typeof raw['lastInboundAt'] === 'string' ? Date.parse(raw['lastInboundAt']) : NaN;
  if (!to || Number.isNaN(last)) return null;
  const closesAt = last + WHATSAPP_WINDOW_MS;
  return {
    phone: raw['phone'],
    to,
    open: now.getTime() < closesAt,
    closesAt: new Date(closesAt).toISOString(),
  };
};

import type { TicketDetail } from './support.models';
import { WHATSAPP_WINDOW_MS, whatsappChatOf } from './whatsapp-chat';

const ticket = (over: Partial<TicketDetail>): TicketDetail =>
  ({ createdByType: 'system', metadata: {}, ...over }) as TicketDetail;

const chat = {
  phone: '+573001112233',
  to: 'owner',
  lastInboundAt: '2026-11-25T16:00:00.000Z',
  lastInboundId: 'wamid.in',
};

describe('Soporte › conversación por WhatsApp del ticket', () => {
  it('lee celular y destinatario, y la ventana se cierra 24 horas después del último mensaje', () => {
    const view = whatsappChatOf(
      ticket({ metadata: { whatsappChat: chat } }),
      new Date('2026-11-26T15:59:00.000Z'),
    );
    expect(view).toEqual({
      phone: '+573001112233',
      to: 'owner',
      open: true,
      closesAt: new Date(Date.parse(chat.lastInboundAt) + WHATSAPP_WINDOW_MS).toISOString(),
    });
    expect(
      whatsappChatOf(ticket({ metadata: { whatsappChat: chat } }), new Date('2026-11-26T16:00:00.000Z'))
        ?.open,
    ).toBe(false);
  });

  it('sin conversación, con datos rotos o en un ticket que no es automático no hay nada', () => {
    const now = new Date('2026-11-25T17:00:00.000Z');
    expect(whatsappChatOf(ticket({}), now)).toBeNull();
    expect(
      whatsappChatOf(ticket({ metadata: { whatsappChat: { ...chat, lastInboundAt: 'x' } } }), now),
    ).toBeNull();
    expect(
      whatsappChatOf(ticket({ createdByType: 'user', metadata: { whatsappChat: chat } }), now),
    ).toBeNull();
  });
});

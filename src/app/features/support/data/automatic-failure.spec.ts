import { automaticFailureOf, failureReasonKeyOf } from './automatic-failure';

const base = {
  createdByType: 'system' as const,
  metadata: {
    origin: 'signing_failure',
    identityId: 'i1',
    signerEmail: 'julian@x.co',
    ownerId: 'u1',
    documentName: 'Contrato de obra',
    failures: [
      {
        code: 'SELFIE_BAJA_CALIDAD',
        group: 'quality',
        hint: 'selfie',
        blocked: false,
        attempts: 1,
        max: 3,
        at: '2026-11-25T15:00:00.000Z',
      },
      { code: 'raro', at: 'no-fecha' },
      'basura',
    ],
    notices: [
      {
        to: 'signer',
        sent: true,
        phone: '+573001112233',
        messageId: 'wamid.1',
        at: '2026-11-25T15:00:01.000Z',
      },
      { to: 'nadie', sent: true, at: '2026-11-25T15:00:01.000Z' },
    ],
  },
};

describe('Fallo de firma de un ticket automático', () => {
  it('solo los tickets del sistema por un fallo de firma lo tienen', () => {
    expect(automaticFailureOf({ createdByType: 'signer', metadata: base.metadata })).toBeNull();
    expect(automaticFailureOf({ createdByType: 'system', metadata: {} })).toBeNull();
  });

  it('lee el documento, el correo del firmante, los fallos y los WhatsApp válidos', () => {
    expect(automaticFailureOf(base)).toEqual({
      documentName: 'Contrato de obra',
      signerEmail: 'julian@x.co',
      failures: [
        {
          code: 'SELFIE_BAJA_CALIDAD',
          group: 'quality',
          hint: 'selfie',
          blocked: false,
          attempts: 1,
          max: 3,
          at: '2026-11-25T15:00:00.000Z',
        },
      ],
      notices: [
        {
          to: 'signer',
          sent: true,
          phone: '+573001112233',
          messageId: 'wamid.1',
          at: '2026-11-25T15:00:01.000Z',
        },
      ],
    });
  });

  it('un ticket automático viejo, sin registro, sale con listas vacías', () => {
    expect(
      automaticFailureOf({ createdByType: 'system', metadata: { origin: 'signing_failure' } }),
    ).toEqual({ failures: [], notices: [] });
  });

  it('el motivo se busca por código, la foto de pantalla tiene el suyo y lo desconocido es técnico', () => {
    expect(failureReasonKeyOf({ code: 'CEDULA_NO_COINCIDE' })).toBe(
      'support.failure.reason.CEDULA_NO_COINCIDE',
    );
    expect(failureReasonKeyOf({ code: 'CEDULA_ILEGIBLE', hint: 'recapture' })).toBe(
      'support.failure.reason.RECAPTURE',
    );
    expect(failureReasonKeyOf({ code: 'DOCUMENTO_SIN_ROSTRO' })).toBe(
      'support.failure.reason.DOCUMENTO_SIN_ROSTRO',
    );
    expect(failureReasonKeyOf({ code: 'FOTO_NO_VALIDA' })).toBe(
      'support.failure.reason.FOTO_NO_VALIDA',
    );
    expect(failureReasonKeyOf({ code: 'OTRA_COSA' })).toBe('support.failure.reason.other');
  });
});

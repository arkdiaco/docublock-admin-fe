import en from '../../../../public/i18n/en.json';
import es from '../../../../public/i18n/es.json';
import { SUPPORT_ERRORS } from './data/support-errors';
import {
  TICKET_CATEGORIES,
  TICKET_CHANNELS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketSla,
  type TicketSummary,
} from './data/support.models';
import {
  DEFAULT_MATRIX,
  TICKET_VIEWS,
  attachmentNameOf,
  auditValueKindOf,
  durationParts,
  isDefaultPolicyName,
  matrixOf,
  matrixProblemOf,
  slaGoalsOf,
  slaStateOf,
  staffNamesOf,
} from './data/ticket-view';

const leaf = (catalog: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      catalog,
    );

const leaves = (node: unknown, prefix = ''): string[] =>
  typeof node === 'string'
    ? [prefix]
    : Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
        leaves(v, prefix ? `${prefix}.${k}` : k),
      );

const now = new Date('2026-10-30T12:00:00.000Z');

const sla = (over: Partial<TicketSla> = {}): TicketSla => ({
  policyName: 'default',
  firstResponseMinutes: 240,
  resolutionMinutes: 1440,
  firstResponseDueAt: '2026-10-30T14:00:00.000Z',
  resolutionDueAt: '2026-10-31T10:00:00.000Z',
  firstRespondedAt: null,
  resolvedAt: null,
  closedAt: null,
  firstResponseBreached: false,
  resolutionBreached: false,
  ...over,
});

const ticket = (
  status: TicketSummary['status'],
  over: Partial<TicketSla> = {},
): Pick<TicketSummary, 'status' | 'sla'> => ({ status, sla: sla(over) });

describe('Soporte: estado del SLA', () => {
  it('un incumplimiento marcado manda sobre todo lo demás', () => {
    expect(slaStateOf(ticket('resolved', { resolutionBreached: true }), now)).toBe('breached');
    expect(slaStateOf(ticket('open', { firstResponseBreached: true }), now)).toBe('breached');
  });

  it('abierto con un plazo pasado sin el evento está vencido; cerrado sin incumplir está cumplido', () => {
    expect(
      slaStateOf(ticket('open', { firstResponseDueAt: '2026-10-30T11:00:00.000Z' }), now),
    ).toBe('overdue');
    expect(
      slaStateOf(
        ticket('in_progress', {
          firstResponseDueAt: '2026-10-30T11:00:00.000Z',
          firstRespondedAt: '2026-10-30T10:30:00.000Z',
        }),
        now,
      ),
    ).toBe('onTime');
    expect(slaStateOf(ticket('closed', { resolutionDueAt: '2026-10-01T00:00:00.000Z' }), now)).toBe(
      'met',
    );
  });

  it('las metas dicen cuál se cumplió, cuál vence y cuál está en plazo', () => {
    const goals = slaGoalsOf(
      ticket('waiting_customer', {
        firstRespondedAt: '2026-10-30T09:00:00.000Z',
        resolutionDueAt: '2026-10-30T11:00:00.000Z',
      }),
      now,
    );
    expect(goals.map((g) => [g.key, g.state])).toEqual([
      ['firstResponse', 'met'],
      ['resolution', 'overdue'],
    ]);
    expect(slaGoalsOf(ticket('open'), now).map((g) => g.state)).toEqual(['pending', 'pending']);
  });

  it('la política fija «default» es la matriz por defecto', () => {
    expect(isDefaultPolicyName({ policyName: 'default' })).toBe(true);
    expect(isDefaultPolicyName({ policyName: '' })).toBe(true);
    expect(isDefaultPolicyName({ policyName: 'Premium' })).toBe(false);
  });
});

describe('Soporte: duraciones y matriz', () => {
  it('parte los minutos en días, horas y minutos sin ruido', () => {
    expect(durationParts(45)).toEqual([{ unit: 'min', n: 45 }]);
    expect(durationParts(90)).toEqual([
      { unit: 'h', n: 1 },
      { unit: 'min', n: 30 },
    ]);
    expect(durationParts(2 * 1440 + 3 * 60 + 5)).toEqual([
      { unit: 'd', n: 2 },
      { unit: 'h', n: 3 },
    ]);
    expect(durationParts(0)).toEqual([{ unit: 'min', n: 0 }]);
    expect(durationParts(null)).toEqual([]);
  });

  it('una matriz incompleta se completa con la de por defecto', () => {
    const matrix = matrixOf({
      matrix: { high: { firstResponseMinutes: 30, resolutionMinutes: 120 }, low: 'roto' },
    });
    expect(matrix.high).toEqual({ firstResponseMinutes: 30, resolutionMinutes: 120 });
    expect(matrix.low).toEqual(DEFAULT_MATRIX.low);
    expect(Object.keys(matrix).sort()).toEqual([...TICKET_PRIORITIES].sort());
  });

  it('valida rango y orden como el core', () => {
    expect(matrixProblemOf(DEFAULT_MATRIX)).toBeNull();
    expect(
      matrixProblemOf({
        ...DEFAULT_MATRIX,
        low: { firstResponseMinutes: 0, resolutionMinutes: 10 },
      }),
    ).toBe('range');
    expect(
      matrixProblemOf({
        ...DEFAULT_MATRIX,
        low: { firstResponseMinutes: 525_601, resolutionMinutes: 525_601 },
      }),
    ).toBe('range');
    expect(
      matrixProblemOf({
        ...DEFAULT_MATRIX,
        high: { firstResponseMinutes: 60, resolutionMinutes: 30 },
      }),
    ).toBe('order');
  });
});

describe('Soporte: historial y adjuntos', () => {
  it('cada acción del historial sabe qué tipo de valor muestra', () => {
    expect(auditValueKindOf('status_change')).toBe('status');
    expect(auditValueKindOf('reopened')).toBe('status');
    expect(auditValueKindOf('priority_change')).toBe('priority');
    expect(auditValueKindOf('assignment')).toBe('agent');
    expect(auditValueKindOf('message_added')).toBe('none');
  });

  it('los nombres del personal salen de las asignaciones y del agente actual', () => {
    const names = staffNamesOf(
      [
        {
          assignedToId: 'a1',
          assignedToName: 'Sam Soporte',
          assignedById: 'a2',
          assignedByName: 'Lía Admin',
          createdAt: '',
        },
      ],
      { id: 'a3', name: 'Nora' },
    );
    expect(Object.fromEntries(names)).toEqual({ a1: 'Sam Soporte', a2: 'Lía Admin', a3: 'Nora' });
  });

  it('el nombre del adjunto es el último tramo, sin consulta y decodificado', () => {
    expect(attachmentNameOf('firma/organizations/o1/documents/abc/recibo%20pago.pdf')).toBe(
      'recibo pago.pdf',
    );
    expect(attachmentNameOf('https://bucket.example/x/y/foto.png?sig=1')).toBe('foto.png');
    expect(attachmentNameOf('%E0%A4%A')).toBe('%E0%A4%A');
  });
});

describe('Soporte: textos', () => {
  it('cada estado, prioridad, categoría, canal, vista y error tiene frase en español e inglés', () => {
    const keys = [
      ...TICKET_STATUSES.map((s) => `support.status.${s}`),
      ...TICKET_PRIORITIES.map((p) => `support.priority.${p}`),
      ...TICKET_CATEGORIES.map((c) => `support.category.${c}`),
      ...TICKET_CHANNELS.map((c) => `support.channel.${c}`),
      ...TICKET_VIEWS.flatMap((v) => [`support.view.${v}`, `support.emptyLead.${v}`]),
      ...[...SUPPORT_ERRORS, 'generic'].map((code) => `support.error.${code}`),
      ...['signer', 'user', 'agent', 'system'].map((a) => `support.author.${a}`),
      ...['breached', 'overdue', 'onTime', 'met'].map((s) => `support.sla.${s}`),
      ...['met', 'breached', 'overdue', 'pending'].map((s) => `support.goal.${s}`),
      ...[
        'created',
        'first_response',
        'message_added',
        'status_change',
        'priority_change',
        'assignment',
        'reopened',
        'resolved',
        'closed',
      ].map((a) => `support.audit.${a}`),
    ];
    for (const key of keys) {
      expect(typeof leaf(es, key), `${key} en es`).toBe('string');
      expect(typeof leaf(en, key), `${key} en en`).toBe('string');
    }
  });

  it('español e inglés tienen las mismas llaves de soporte', () => {
    expect(leaves(en.support).sort()).toEqual(leaves(es.support).sort());
  });

  it('ninguna etiqueta de botón de confirmación interpola', () => {
    const confirms = [
      'support.act.status.confirm',
      'support.act.priority.confirm',
      'support.act.assign.confirm',
      'support.pol.seed',
      'support.pol.deactivate',
      'support.pol.reactivate',
    ];
    for (const key of confirms) expect(String(leaf(es, key))).not.toContain('{{');
  });
});

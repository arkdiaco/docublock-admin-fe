import en from '../../../../public/i18n/en.json';
import es from '../../../../public/i18n/es.json';
import { ACTIVITY_ACTIONS, activityKeyOf } from './data/activity-actions';
import type { DashboardActionGroup, MonthRevenue } from './data/dashboard.models';
import { actionRowsOf, eventRef, revenueViewOf } from './data/dashboard-view';

const org = (id: string) => ({ id, businessName: `Org ${id}`, tributaryNumber: `NIT-${id}` });
const quota = (id: string, used: number, limit: number) => ({ organization: org(id), used, limit });
const PATHS = { orgs: '/o', docs: '/d', support: '/s' };

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

describe('Visión general: filas de «Requiere acción»', () => {
  const groups: DashboardActionGroup[] = [
    { kind: 'QUOTA_EXHAUSTED', total: 1, items: [quota('a', 500, 500)] },
    {
      kind: 'TICKET_OVERDUE',
      total: 4,
      items: [{ ticket: { id: 't', ticketNumber: 'SOP-1', subject: 'x' }, organization: null }],
    },
    {
      kind: 'SUBSCRIPTION_EXPIRING',
      total: 2,
      items: [
        { organization: org('b'), daysLeft: 3, periodEnd: null },
        { organization: org('c'), daysLeft: 1, periodEnd: null },
      ],
    },
    {
      kind: 'QUOTA_WARNING',
      total: 9,
      items: [quota('d', 94, 100), quota('e', 91, 100), quota('f', 90, 100)],
    },
    { kind: 'DOCUMENT_ISSUE', total: 2, items: [{ issue: 'UNREGISTERED_BLOCKCHAIN', count: 12 }] },
  ];

  it('pinta todos los grupos en el orden del core, hasta cinco filas; el contador suma sus totales', () => {
    const view = actionRowsOf(groups, PATHS);
    expect(view.total).toBe(1 + 4 + 2 + 9 + 2);
    expect(view.rows.map((r) => r.key)).toEqual([
      'QUOTA_EXHAUSTED:a',
      'TICKET_OVERDUE:t',
      'SUBSCRIPTION_EXPIRING:b',
      'SUBSCRIPTION_EXPIRING:c',
      'QUOTA_WARNING:d',
    ]);
  });

  it('cada fila lleva a la pestaña que resuelve: cupos o suscripción', () => {
    const [exhausted, , expiring, tomorrow, warning] = actionRowsOf(groups, PATHS).rows;
    expect(exhausted).toMatchObject({
      tone: 'bad',
      reference: 'NIT-a',
      subject: 'Org a',
      textKey: 'overview.action.quotaExhausted',
      textParams: { used: 500, limit: 500, pct: 100 },
      link: ['/o', 'a'],
      query: { tab: 'quotas' },
    });
    expect(expiring).toMatchObject({
      tone: 'warn',
      textKey: 'overview.action.expiring',
      textParams: { n: 3 },
      query: { tab: 'subscription' },
    });
    expect(tomorrow.textKey).toBe('overview.action.expiringTomorrow');
    expect(warning).toMatchObject({
      tone: 'warn',
      textKey: 'overview.action.quotaWarning',
      textParams: { pct: 94 },
    });
  });

  it('el porcentaje del aviso nunca redondea hacia arriba hasta el 100', () => {
    const [row] = actionRowsOf(
      [{ kind: 'QUOTA_WARNING', total: 1, items: [quota('z', 999, 1000)] }],
      PATHS,
    ).rows;
    expect(row.textParams['pct']).toBe(99);
  });

  it('vence hoy cuando no quedan días', () => {
    const [row] = actionRowsOf(
      [
        {
          kind: 'SUBSCRIPTION_EXPIRING',
          total: 1,
          items: [{ organization: org('h'), daysLeft: 0, periodEnd: null }],
        },
      ],
      PATHS,
    ).rows;
    expect(row.textKey).toBe('overview.action.expiringToday');
  });

  it('las incidencias de documentos llevan a la pestaña de Documentos que las resuelve', () => {
    const rows = actionRowsOf(
      [
        {
          kind: 'DOCUMENT_ISSUE',
          total: 2,
          items: [
            { issue: 'UNREGISTERED_BLOCKCHAIN', count: 12 },
            { issue: 'STUCK_COMPLETED', count: 3 },
          ],
        },
      ],
      PATHS,
    ).rows;
    expect(rows).toEqual([
      expect.objectContaining({
        tone: 'warn',
        subjectKey: 'nav.documents',
        textKey: 'overview.action.docUnregistered',
        textParams: { n: 12 },
        link: ['/d'],
        query: { vista: 'blockchain' },
      }),
      expect.objectContaining({
        tone: 'bad',
        textKey: 'overview.action.docStuck',
        textParams: { n: 3 },
        query: { vista: 'atascados' },
      }),
    ]);
  });
});

describe('Visión general: tickets vencidos', () => {
  it('cada ticket vencido lleva a su ficha en la pestaña SLA y nombra la organización si la hay', () => {
    const rows = actionRowsOf(
      [
        {
          kind: 'TICKET_OVERDUE',
          total: 7,
          items: [
            {
              ticket: { id: 't1', ticketNumber: 'TKT-2026-000001', subject: 'No llega la clave' },
              organization: { id: 'o1', name: 'Org uno' },
            },
            {
              ticket: { id: 't2', ticketNumber: 'TKT-2026-000002', subject: 'Sin organización' },
              organization: null,
            },
          ],
        },
      ],
      PATHS,
    );
    expect(rows.total).toBe(7);
    expect(rows.rows).toEqual([
      expect.objectContaining({
        key: 'TICKET_OVERDUE:t1',
        tone: 'bad',
        reference: 'TKT-2026-000001',
        subject: 'No llega la clave',
        textKey: 'overview.action.ticketOverdue',
        textParams: { org: 'Org uno' },
        link: ['/s', 't1'],
        query: { tab: 'sla' },
      }),
      expect.objectContaining({
        key: 'TICKET_OVERDUE:t2',
        textKey: 'overview.action.ticketOverdueNoOrg',
        link: ['/s', 't2'],
      }),
    ]);
    for (const key of ['ticketOverdue', 'ticketOverdueNoOrg']) {
      expect(typeof leaf(es, `overview.action.${key}`)).toBe('string');
      expect(typeof leaf(en, `overview.action.${key}`)).toBe('string');
    }
  });
});

describe('Visión general: ingresos del mes', () => {
  const fmt = (amount: number, currency: string) => `${currency} ${amount}`;
  const revenue = (over: Partial<MonthRevenue>): MonthRevenue => ({
    currency: 'COP',
    gross: 1000,
    previousGross: 800,
    otherCurrencies: 0,
    ...over,
  });

  it('compara contra el mes anterior con signo', () => {
    expect(revenueViewOf(revenue({}), fmt, 'sept')).toEqual({
      value: 'COP 1000',
      deltaKey: 'overview.revenueDelta',
      deltaParams: { diff: '+COP 200', month: 'sept' },
      tone: 'good',
      others: 0,
    });
    expect(revenueViewOf(revenue({ gross: 500 }), fmt, 'sept').deltaParams['diff']).toBe(
      '−COP 300',
    );
    expect(revenueViewOf(revenue({ gross: 500 }), fmt, 'sept').tone).toBe('warn');
  });

  it('sin mes anterior no inventa porcentaje y avisa de otras monedas', () => {
    const view = revenueViewOf(revenue({ previousGross: 0, otherCurrencies: 2 }), fmt, 'sept');
    expect(view.deltaKey).toBe('overview.revenueNoPrevious');
    expect(view.others).toBe(2);
  });

  it('sin transacciones aprobadas muestra la raya y lo dice', () => {
    const view = revenueViewOf(
      revenue({ currency: null, gross: 0, previousGross: 0 }),
      fmt,
      'sept',
    );
    expect(view).toMatchObject({ value: '—', deltaKey: 'overview.revenueNone' });
  });
});

describe('Visión general: frases de la actividad', () => {
  it('todas las acciones conocidas tienen frase en español e inglés, y no sobra ninguna', () => {
    for (const action of ACTIVITY_ACTIONS) {
      const key = activityKeyOf(action)!;
      expect(typeof leaf(es, key), `${key} en es`).toBe('string');
      expect(typeof leaf(en, key), `${key} en en`).toBe('string');
    }
    const known = ACTIVITY_ACTIONS.map((a) => `act.${a}`).sort();
    expect(leaves((es as Record<string, unknown>)['act'], 'act').sort()).toEqual(known);
    expect(leaves((en as Record<string, unknown>)['act'], 'act').sort()).toEqual(known);
  });

  it('una acción desconocida no tiene llave: se muestra su código', () => {
    expect(activityKeyOf('organization.suspend')).toBe('act.organization.suspend');
    expect(activityKeyOf('algo.nuevo')).toBeNull();
  });

  it('la referencia del evento se acorta como en el diseño', () => {
    expect(eventRef('8f3a00000000000000c21d')).toBe('evt 8f3a…c21d');
    expect(eventRef('abc')).toBe('evt abc');
  });
});

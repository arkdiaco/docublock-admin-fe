import {
  bucketLabelOf,
  changeOf,
  periodRangeOf,
  signatureFiltersOf,
  signatureQueryParamsOf,
  signatureRangeIssue,
  signaturesRequestOf,
  todayIn,
  type SignatureFilters,
} from './signature-filters';

const HOY = '2026-11-19';
const ORG = '64b000000000000000000001';

const filtros = (over: Partial<SignatureFilters> = {}): SignatureFilters => ({
  period: '30-dias',
  from: null,
  to: null,
  organizationId: null,
  channel: 'todos',
  ...over,
});

describe('Analítica: filtros de firmas', () => {
  it('sin nada en la URL mira los últimos 30 días de todos los canales', () => {
    expect(signatureFiltersOf({})).toEqual(filtros());
  });

  it('lee período, fechas, organización y canal, y descarta lo que no sirve', () => {
    expect(
      signatureFiltersOf({
        periodo: 'personalizado',
        desde: '2026-10-01',
        hasta: '2026-10-31',
        organizacion: ORG,
        canal: 'integracion',
      }),
    ).toEqual(
      filtros({
        period: 'personalizado',
        from: '2026-10-01',
        to: '2026-10-31',
        organizationId: ORG,
        channel: 'integracion',
      }),
    );
    expect(
      signatureFiltersOf({ periodo: 'siempre', organizacion: 'otra', canal: 'fax', desde: 'ayer' }),
    ).toEqual(filtros());
  });

  it('fechas sueltas en la URL valen como período personalizado', () => {
    expect(signatureFiltersOf({ desde: '2026-10-01' })).toEqual(
      filtros({ period: 'personalizado', from: '2026-10-01' }),
    );
  });

  it('la URL solo guarda lo que cambia frente a la vista por defecto', () => {
    expect(signatureQueryParamsOf(filtros())).toEqual({
      periodo: null,
      desde: null,
      hasta: null,
      organizacion: null,
      canal: null,
    });
    expect(
      signatureQueryParamsOf(
        filtros({
          period: 'mes-pasado',
          from: '2026-01-01',
          organizationId: ORG,
          channel: 'plataforma',
        }),
      ),
    ).toEqual({
      periodo: 'mes-pasado',
      desde: null,
      hasta: null,
      organizacion: ORG,
      canal: 'plataforma',
    });
    expect(
      signatureQueryParamsOf(
        filtros({ period: 'personalizado', from: '2026-10-01', to: '2026-10-31' }),
      ),
    ).toMatchObject({ periodo: 'personalizado', desde: '2026-10-01', hasta: '2026-10-31' });
  });

  it('cada período se traduce en días concretos', () => {
    const rango = (period: SignatureFilters['period']) => periodRangeOf(filtros({ period }), HOY);
    expect(rango('hoy')).toEqual({ from: HOY, to: HOY });
    expect(rango('7-dias')).toEqual({ from: '2026-11-13', to: HOY });
    expect(rango('30-dias')).toEqual({ from: '2026-10-21', to: HOY });
    expect(rango('este-mes')).toEqual({ from: '2026-11-01', to: HOY });
    expect(rango('mes-pasado')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(rango('este-anio')).toEqual({ from: '2026-01-01', to: HOY });
    expect(rango('anio-pasado')).toEqual({ from: '2025-01-01', to: '2025-12-31' });
    expect(periodRangeOf(filtros({ period: 'mes-pasado' }), '2026-03-31')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(periodRangeOf(filtros({ period: 'mes-pasado' }), '2026-01-15')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('el personalizado usa lo que se escribió; sin fechas, el core decide', () => {
    expect(
      periodRangeOf(
        filtros({ period: 'personalizado', from: '2026-10-01', to: '2026-10-15' }),
        HOY,
      ),
    ).toEqual({ from: '2026-10-01', to: '2026-10-15' });
    expect(periodRangeOf(filtros({ period: 'personalizado' }), HOY)).toEqual({});
  });

  it('avisa del rango al revés antes de pedirlo; el largo no tiene tope', () => {
    const personal = (from: string, to: string) =>
      signatureRangeIssue(filtros({ period: 'personalizado', from, to }), HOY);
    expect(personal('2026-10-31', '2026-10-01')).toBe('RANGO_INVERTIDO');
    expect(personal('2018-01-01', '2026-11-19')).toBeNull();
    expect(personal('2024-11-19', '2026-11-19')).toBeNull();
    expect(signatureRangeIssue(filtros(), HOY)).toBeNull();
  });

  it('arma el pedido al core con el canal en su idioma', () => {
    expect(
      signaturesRequestOf(
        filtros({ channel: 'integracion', organizationId: ORG }),
        HOY,
        'America/Bogota',
      ),
    ).toEqual({
      from: '2026-10-21',
      to: HOY,
      tz: 'America/Bogota',
      organizationId: ORG,
      channel: 'integration',
    });
    expect(signaturesRequestOf(filtros({ period: 'personalizado' }), HOY, 'UTC')).toEqual({
      tz: 'UTC',
      channel: 'all',
    });
    expect(signaturesRequestOf(filtros({ channel: 'plataforma' }), HOY, 'UTC').channel).toBe(
      'platform',
    );
  });

  it('el cambio frente al período anterior es un porcentaje entero; sin base no hay cambio', () => {
    expect(changeOf(118, 100)).toBe(18);
    expect(changeOf(90, 120)).toBe(-25);
    expect(changeOf(5, 5)).toBe(0);
    expect(changeOf(7, 0)).toBeNull();
    expect(changeOf(0, 0)).toBeNull();
  });

  it('el día de hoy sale en la zona horaria pedida', () => {
    const now = new Date('2026-11-20T03:00:00Z');
    expect(todayIn(now, 'America/Bogota')).toBe('2026-11-19');
    expect(todayIn(now, 'UTC')).toBe('2026-11-20');
  });

  it('rotula cada tramo de la gráfica según su tamaño', () => {
    expect(bucketLabelOf('2026-11-03', 'day', 'es', false)).toBe('3');
    expect(bucketLabelOf('2026-11-03', 'week', 'es', false)).toBe('3/11');
    expect(bucketLabelOf('2026-11-01', 'month', 'es', false)).toBe('nov');
    expect(bucketLabelOf('2026-01-01', 'month', 'es', true)).toBe('ene 26');
  });
});

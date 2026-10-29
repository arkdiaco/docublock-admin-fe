import { actorHandle, parseAuditFilter, withToken } from './audit-filter';

const ACTORES = [
  { id: '65a000000000000000000001', email: 'marta.vidal@docublock.co', name: 'Marta Vidal' },
  { id: '65a000000000000000000002', email: 'ernesto@docublock.co', name: 'Ernesto Salas' },
];

describe('parseAuditFilter', () => {
  it('traduce cada llave a su filtro, con el actor por correo o por su usuario', () => {
    const { filters, problems } = parseAuditFilter(
      'actor:marta.vidal org:65a0000000000000000000aa accion:staff objeto:platform_admin desde:2026-10-01 hasta:2026-10-28',
      ACTORES,
    );
    expect(problems).toEqual([]);
    expect(filters).toEqual({
      adminId: '65a000000000000000000001',
      organizationId: '65a0000000000000000000aa',
      action: 'staff',
      targetType: 'platform_admin',
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-28T23:59:59.999Z',
    });
    expect(parseAuditFilter('actor:ERNESTO@docublock.co', ACTORES).filters.adminId).toBe(
      '65a000000000000000000002',
    );
  });

  it('cuenta lo que no entiende en vez de ignorarlo en silencio', () => {
    const { filters, problems } = parseAuditFilter(
      'hola actor:nadie org:123 desde:ayer accion:Staff',
      ACTORES,
    );
    expect(filters).toEqual({});
    expect(problems).toEqual([
      { kind: 'unknownKey', token: 'hola' },
      { kind: 'unknownActor', value: 'nadie' },
      { kind: 'badValue', key: 'org', value: '123' },
      { kind: 'badValue', key: 'desde', value: 'ayer' },
      { kind: 'badValue', key: 'accion', value: 'Staff' },
    ]);
  });

  it('vacío no filtra nada', () => {
    expect(parseAuditFilter('   ', ACTORES)).toEqual({ filters: {}, problems: [] });
  });
});

describe('withToken y actorHandle', () => {
  it('reemplaza la llave si ya estaba y agrega si no', () => {
    expect(withToken('actor:marta accion:staff', 'actor', 'ernesto')).toBe(
      'accion:staff actor:ernesto',
    );
    expect(withToken('', 'org', 'abc')).toBe('org:abc');
  });

  it('el usuario del correo identifica al actor; sin correo, su id', () => {
    expect(actorHandle(ACTORES[0])).toBe('marta.vidal');
    expect(actorHandle({ id: 'x1' })).toBe('x1');
  });
});

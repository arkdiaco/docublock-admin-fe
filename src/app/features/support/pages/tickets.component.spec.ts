import { TestBed } from '@angular/core/testing';
import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import type { HttpRequest } from '@angular/common/http';
import type { TicketMetrics } from '../data/support.models';
import { TicketsComponent } from './tickets.component';
import { conPermisos, configurar, resumen } from './support-test-kit';

const metrics: TicketMetrics = {
  total: 12,
  open: 5,
  unassignedOpen: 2,
  byStatus: {},
  byPriority: {},
  byCategory: {},
  firstResponseBreached: 1,
  resolutionBreached: 2,
  overdueFirstResponse: 1,
  overdueResolution: 0,
  avgFirstResponseMinutes: 90,
  avgResolutionMinutes: 1500,
};

const isList = (r: HttpRequest<unknown>) => r.url === '/platform/support/tickets';

describe('Operación › Soporte › bandeja', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const responder = (organizationId: string | null = null) => {
    const org = (r: HttpRequest<unknown>) => r.params.get('organizationId') === organizationId;
    http.expectOne((r) => r.url === '/platform/support/metrics' && org(r)).flush(metrics);
    http
      .expectOne((r) => isList(r) && r.params.get('overdue') === 'true' && org(r))
      .flush({ total: 3, items: [] });
    http
      .expectOne((r) => isList(r) && r.params.get('breached') === 'true' && org(r))
      .flush({ total: 3, items: [] });
  };

  const montar = async () => {
    const fixture = TestBed.createComponent(TicketsComponent);
    fixture.detectChanges();
    responder();
    http
      .expectOne('/platform/support/agents')
      .flush([{ id: 'a1', name: 'Sam Soporte', email: 's@x.co' }]);
    const main: TestRequest = http.expectOne((r) => isList(r) && r.params.get('limit') === '20');
    main.flush({ total: 1, items: [resumen({ assignee: { id: 'a1', name: 'Sam Soporte' } })] });
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('dba-data-table')?.textContent).toContain('TKT-2026-000001');
    });
    return { fixture, host, main };
  };

  it('pinta vistas con conteos, promedios y la fila con su SLA', async () => {
    conPermisos(['platform:operations']);
    const { host } = await montar();
    const band = host.querySelector('db-stat-band')!.textContent!;
    expect(band).toContain('Todos');
    expect(band).toContain('12');
    expect(band).toContain('1 en primera respuesta · 2 en resolución');
    expect(host.querySelector('.tk__avg')?.textContent).toContain('1 h 30 min');
    expect(host.querySelector('.tk__avg')?.textContent).toContain('1 d 1 h');
    const table = host.querySelector('dba-data-table')!.textContent!;
    expect(table).toContain('Notaría 14');
    expect(table).toContain('Alta');
    expect(table).toContain('A tiempo');
    expect(table).toContain('Sam Soporte');
    expect(host.textContent).not.toMatch(/\b(support|nav|common)\.[a-zA-Z]/);
  });

  it('elegir una vista filtra la lista como el core', async () => {
    conPermisos(['platform:operations']);
    const { fixture } = await montar();
    (fixture.componentInstance as unknown as { pickView: (k: string) => void }).pickView(
      'sin-asignar',
    );
    const req = http.expectOne((r) => isList(r) && r.params.get('limit') === '20');
    expect(req.request.params.get('open')).toBe('true');
    expect(req.request.params.get('unassigned')).toBe('true');
    expect(req.request.params.get('assignedToId')).toBeNull();
    req.flush({ total: 0, items: [] });
  });

  it('filtrar por organización recalcula también los conteos de esa organización', async () => {
    conPermisos(['platform:operations', 'platform:clients']);
    const { fixture } = await montar();
    (
      fixture.componentInstance as unknown as { pickOrganization: (id: string | null) => void }
    ).pickOrganization('o9');
    responder('o9');
    const req = http.expectOne((r) => isList(r) && r.params.get('limit') === '20');
    expect(req.request.params.get('organizationId')).toBe('o9');
    req.flush({ total: 0, items: [] });
  });
});

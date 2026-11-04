import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { conPermisos, configurar, entidad, porRegistrar } from './legal-entities-test-kit';
import { LegalEntitiesComponent } from './legal-entities.component';

const COUNTS = { all: 2, active: 1, inactive: 1, pending: 3 };

describe('Entidades jurídicas › Lista', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<LegalEntitiesComponent>;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const abrir = (permisos: string[]): HTMLElement => {
    conPermisos(permisos);
    fixture = TestBed.createComponent(LegalEntitiesComponent);
    fixture.detectChanges();
    http.expectOne('/catalogs/countries').flush([{ id: 'co', name: 'Colombia' }]);
    return fixture.nativeElement as HTMLElement;
  };

  const lista = () => http.expectOne((req) => req.url === '/platform/legal-entities');
  const pendientes = () => http.expectOne((req) => req.url === '/platform/legal-entities/pending');

  const ver = async (host: HTMLElement, texto: string): Promise<void> => {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain(texto);
    });
  };

  it('pinta entidades, conteos y el aviso sin llaves crudas', async () => {
    const host = abrir(['platform:clients']);
    lista().flush({
      total: 2,
      counts: COUNTS,
      items: [
        entidad(),
        entidad({ id: 'e2', businessName: 'Beta', active: false, legalRepName: undefined }),
      ],
    });
    await ver(host, 'Acme SAS');
    expect(host.textContent).toContain('Beta');
    expect(host.textContent).toContain('Inactiva');
    expect(host.textContent).toContain('Por registrar');
    expect(host.textContent).toContain('no cambia cómo firma nadie');
    expect(host.textContent).not.toMatch(/\bjur\.[a-z]/);
  });

  it('sin entidades y con empresas por registrar abre en esa vista, una sola vez', async () => {
    const host = abrir(['platform:clients:manage']);
    lista().flush({
      total: 0,
      counts: { all: 0, active: 0, inactive: 0, pending: 1 },
      items: [],
    });
    const pedido = await vi.waitFor(() => pendientes());
    pedido.flush({
      total: 1,
      counts: { all: 0, active: 0, inactive: 0, pending: 1 },
      items: [porRegistrar()],
    });
    await ver(host, 'Gravitar SAS');
    expect(host.textContent).toContain('Registrar');
    expect(host.textContent).toContain('1032409749');

    const todas = [...host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Todas'),
    );
    todas?.click();
    const otra = await vi.waitFor(() => lista());
    otra.flush({ total: 0, counts: { all: 0, active: 0, inactive: 0, pending: 1 }, items: [] });
    await ver(host, 'Sin entidades en esta vista');
    http.expectNone((req) => req.url === '/platform/legal-entities/pending');
  });

  it('con solo lectura no ofrece crear ni registrar', async () => {
    const host = abrir(['platform:clients']);
    lista().flush({ total: 0, counts: { all: 0, active: 0, inactive: 0, pending: 1 }, items: [] });
    const pedido = await vi.waitFor(() => pendientes());
    pedido.flush({
      total: 1,
      counts: { all: 0, active: 0, inactive: 0, pending: 1 },
      items: [porRegistrar()],
    });
    await ver(host, 'Gravitar SAS');
    const textos = [...host.querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(textos).not.toContain('Registrar');
    expect(textos.join()).not.toContain('Nueva entidad');
  });

  it('muestra quién no tiene firmante con ese documento', async () => {
    const host = abrir(['platform:clients']);
    lista().flush({ total: 0, counts: { all: 0, active: 0, inactive: 0, pending: 1 }, items: [] });
    const pedido = await vi.waitFor(() => pendientes());
    pedido.flush({
      total: 1,
      counts: { all: 0, active: 0, inactive: 0, pending: 1 },
      items: [porRegistrar({ representative: undefined })],
    });
    await ver(host, 'Sin persona con ese documento');
  });

  it('elegir una vista filtra y vuelve a la primera página', async () => {
    const host = abrir(['platform:clients']);
    lista().flush({ total: 1, counts: COUNTS, items: [entidad()] });
    await ver(host, 'Acme SAS');
    [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Inactivas'))?.click();
    const pedido = await vi.waitFor(() => lista());
    expect(pedido.request.params.get('view')).toBe('inactive');
    expect(pedido.request.params.get('page')).toBe('1');
    pedido.flush({ total: 0, counts: COUNTS, items: [] });
    await ver(host, 'Sin entidades en esta vista');
  });

  it('un fallo de carga ofrece reintentar', async () => {
    const host = abrir(['platform:clients']);
    lista().flush({}, { status: 500, statusText: 'Error' });
    await ver(host, 'No se pudieron cargar las entidades');
  });
});

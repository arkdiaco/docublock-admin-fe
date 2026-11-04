import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UsersComponent } from './users.component';
import { configurar, usuario } from './users-test-kit';

const CONTEOS = { all: 3, active: 2, inactive: 1, without: 1 };

interface Pagina {
  pickView: (view: string) => void;
  pickCountry: (id: string | null) => void;
  goPage: (page: number) => void;
}

describe('Clientes › Usuarios', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const lista = (): TestRequest => http.expectOne((r) => r.url === '/platform/users');

  const montar = async () => {
    const fixture = TestBed.createComponent(UsersComponent);
    fixture.detectChanges();
    http.expectOne('/catalogs/countries').flush([{ id: 'co', name: 'Colombia' }]);
    lista().flush({ total: 1, items: [usuario()], counts: CONTEOS });
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('dba-data-table')).not.toBeNull();
    });
    return { fixture, host, page: fixture.componentInstance as unknown as Pagina };
  };

  it('pinta persona, documento, país, organizaciones y conteos por vista', async () => {
    const { host } = await montar();
    expect(host.textContent).toContain('Ana Pérez Gómez');
    expect(host.textContent).toContain('ana@correo.co');
    expect(host.textContent).toContain('1032456789');
    expect(host.textContent).toContain('Colombia');
    expect(host.textContent).toContain('Usuarios: 1');
    expect(host.textContent).toContain('Sin organización');
    expect(host.querySelector('a.dba-tr')?.getAttribute('href')).toBe('/clientes/usuarios/u1');
  });

  it('la vista y el país viajan al core y vuelven a la primera página', async () => {
    const { page } = await montar();
    page.goPage(2);
    const segunda = lista();
    expect(segunda.request.params.get('page')).toBe('2');
    segunda.flush({ total: 21, items: [usuario()], counts: CONTEOS });
    await Promise.resolve();
    page.pickView('without');
    const vista = lista();
    expect(vista.request.params.get('view')).toBe('without');
    expect(vista.request.params.get('page')).toBe('1');
    vista.flush({ total: 0, items: [], counts: CONTEOS });
    await Promise.resolve();
    page.pickCountry('co');
    const pais = lista();
    expect(pais.request.params.get('countryId')).toBe('co');
    expect(pais.request.params.get('view')).toBe('without');
    pais.flush({ total: 0, items: [], counts: CONTEOS });
  });

  it('la vista Todos y el país vacío no se envían', async () => {
    const { page } = await montar();
    page.pickView('all');
    const req = lista();
    expect(req.request.params.has('view')).toBe(false);
    expect(req.request.params.has('countryId')).toBe(false);
    req.flush({ total: 0, items: [], counts: CONTEOS });
  });

  it('muestra el vacío y permite reintentar tras un error', async () => {
    const fixture = TestBed.createComponent(UsersComponent);
    fixture.detectChanges();
    http.expectOne('/catalogs/countries').flush([], { status: 500, statusText: 'Error' });
    lista().flush({}, { status: 500, statusText: 'Error' });
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain('No pudimos cargar los usuarios.');
    });
    (host.querySelector('.bl__panel button') as HTMLButtonElement).click();
    lista().flush({ total: 0, items: [], counts: CONTEOS });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain('No hay usuarios para mostrar.');
    });
  });
});

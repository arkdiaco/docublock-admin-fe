import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { PromotionsComponent } from './promotions.component';
import { codigo, conPermisos, configurar } from './promotions-test-kit';

interface Pagina {
  create: (body: unknown) => Promise<void>;
  pickView: (view: string) => void;
}

describe('Comercial › Promocionales', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const montar = async (items = [codigo()]) => {
    const fixture = TestBed.createComponent(PromotionsComponent);
    fixture.detectChanges();
    http.expectOne('/catalogs/countries').flush([{ id: 'co', name: 'Colombia' }]);
    http
      .expectOne((r) => r.url === '/platform/promotional-codes')
      .flush({ total: items.length, items });
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('section')).not.toBeNull();
      expect(host.querySelector('db-section-loader')).toBeNull();
    });
    return { fixture, host, page: fixture.componentInstance as unknown as Pagina };
  };

  it('muestra código, uso, país y estado, sin crear si no hay gestión', async () => {
    conPermisos(['platform:commercial']);
    const { host } = await montar([
      codigo(),
      codigo({ id: 'p2', code: 'CO10', countryId: 'co', remaining: 0, redeemed: 10 }),
    ]);
    expect(host.textContent).toContain('LANZA20');
    expect(host.textContent).toContain('Todos los países');
    expect(host.textContent).toContain('Colombia');
    expect(host.textContent).toContain('Disponible');
    expect(host.textContent).toContain('Agotado');
    expect(host.textContent).toContain('Códigos: 2');
    expect(host.textContent).not.toContain('Crear código');
  });

  it('la vista Inactivos pide active=false y vuelve a la primera página', async () => {
    conPermisos(['platform:commercial']);
    const { page } = await montar();
    page.pickView('inactive');
    const req = http.expectOne((r) => r.url === '/platform/promotional-codes');
    expect(req.request.params.get('active')).toBe('false');
    expect(req.request.params.get('page')).toBe('1');
    req.flush({ total: 0, items: [] });
  });

  it('crear lleva a la ficha; si el código existe lo explica sin salir', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { host, page } = await montar();
    expect(host.textContent).toContain('Crear código');

    const fallo = page.create({ name: 'A', code: 'AAA', discount: 5, quantity: 1 });
    http
      .expectOne((r) => r.method === 'POST')
      .flush({ code: 'CODIGO_EN_USO' }, { status: 409, statusText: 'Conflict' });
    await fallo;
    expect(navegar).not.toHaveBeenCalled();

    const bien = page.create({ name: 'A', code: 'BBB', discount: 5, quantity: 1 });
    http.expectOne((r) => r.method === 'POST').flush(codigo({ id: 'p9', code: 'BBB' }));
    await bien;
    expect(navegar).toHaveBeenCalledWith(['/comercial/promocionales', 'p9']);
  });
});

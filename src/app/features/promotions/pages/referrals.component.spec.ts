import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ReferralsComponent } from './referrals.component';
import { conPermisos, configurar, referido } from './promotions-test-kit';

interface Pagina {
  create: (body: unknown) => Promise<void>;
  pickView: (view: string) => void;
  formOpen: { set: (open: boolean) => void };
}

describe('Comercial › Referidos', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const montar = async () => {
    const fixture = TestBed.createComponent(ReferralsComponent);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/platform/referrals').flush({ total: 1, items: [referido()] });
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('dba-data-table')).not.toBeNull();
    });
    return { fixture, host, page: fixture.componentInstance as unknown as Pagina };
  };

  it('lista persona, código y descuento; sin gestión no ofrece crear', async () => {
    conPermisos(['platform:commercial']);
    const { host } = await montar();
    expect(host.textContent).toContain('Ana Gómez');
    expect(host.textContent).toContain('ANA15');
    expect(host.textContent).toContain('15 %');
    expect(host.textContent).toContain('Activo');
    expect(host.textContent).not.toContain('Crear referido');
  });

  it('la vista Activos pide active=true', async () => {
    conPermisos(['platform:commercial']);
    const { page } = await montar();
    page.pickView('active');
    const req = http.expectOne((r) => r.url === '/platform/referrals');
    expect(req.request.params.get('active')).toBe('true');
    req.flush({ total: 0, items: [] });
  });

  it('crear lleva a la ficha; un correo repetido no navega', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { host, page } = await montar();
    expect(host.textContent).toContain('Crear referido');

    const fallo = page.create({ name: 'A', email: 'a@b.co' });
    http
      .expectOne((r) => r.method === 'POST')
      .flush({ code: 'REFERIDO_EMAIL_EN_USO' }, { status: 409, statusText: 'Conflict' });
    await fallo;
    expect(navegar).not.toHaveBeenCalled();

    const bien = page.create({ name: 'A', email: 'a@b.co' });
    http.expectOne((r) => r.method === 'POST').flush(referido({ id: 'r9' }));
    await bien;
    expect(navegar).toHaveBeenCalledWith(['/comercial/referidos', 'r9']);
  });
});

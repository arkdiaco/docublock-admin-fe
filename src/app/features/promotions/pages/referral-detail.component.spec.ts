import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DialogService } from '../../../core/ui/dialog.service';
import { ReferralDetailComponent } from './referral-detail.component';
import { conPermisos, configurar, referido, reporte } from './promotions-test-kit';

const BASE = '/platform/referrals/r1';

interface Ficha {
  deactivate: () => Promise<void>;
  activate: () => Promise<void>;
}

describe('Comercial › Referidos › ficha', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const montar = async (item = referido()) => {
    const fixture = TestBed.createComponent(ReferralDetailComponent);
    fixture.componentRef.setInput('id', 'r1');
    fixture.detectChanges();
    http.expectOne(BASE).flush(item);
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('dba-promo-report')).not.toBeNull();
    });
    fixture.detectChanges();
    http.expectOne((r) => r.url === `${BASE}/report`).flush(reporte());
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('db-stat-band')).not.toBeNull();
    });
    return { fixture, host, page: fixture.componentInstance as unknown as Ficha };
  };

  it('muestra contacto, notas y el código enlazado; sin gestión no ofrece acciones', async () => {
    conPermisos(['platform:commercial']);
    const { host } = await montar();
    expect(host.textContent).toContain('ana@aliados.co');
    expect(host.textContent).toContain('Aliada de notarías');
    expect(host.querySelector('a[href*="/comercial/promocionales/p1"]')?.textContent).toContain(
      'ANA15',
    );
    expect(host.textContent).not.toContain('Editar');
    expect(host.textContent).not.toContain('Desactivar');
  });

  it('desactivar avisa que el código también se apaga', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    const confirmar = vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
    const { fixture, host, page } = await montar();
    const accion = page.deactivate();
    await vi.waitFor(() => expect(confirmar).toHaveBeenCalled());
    expect(confirmar.mock.calls[0]?.[0]).toMatchObject({
      params: { name: 'Ana Gómez', code: 'ANA15' },
    });
    const req = await vi.waitFor(() => http.expectOne((r) => r.method === 'PUT'));
    expect(req.request.body).toEqual({ active: false });
    req.flush(referido({ active: false, code: { ...referido().code, active: false } }));
    await accion;
    fixture.detectChanges();
    expect(host.textContent).toContain('Inactivo');
    expect(host.textContent).toContain('Activar');
  });

  it('reactivar con el correo ocupado deja la ficha como estaba', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    const { fixture, host, page } = await montar(referido({ active: false }));
    const accion = page.activate();
    http
      .expectOne((r) => r.method === 'PUT')
      .flush({ code: 'REFERIDO_EMAIL_EN_USO' }, { status: 409, statusText: 'Conflict' });
    await accion;
    fixture.detectChanges();
    expect(host.textContent).toContain('Activar');
  });
});

import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DialogService } from '../../../core/ui/dialog.service';
import { cartera, conPermisos, configurar, reseller } from '../pages/resellers-test-kit';
import type { PortfolioOrg } from '../data/resellers.models';
import { PortfolioTabComponent } from './portfolio-tab.component';

const PORTFOLIO = '/platform/resellers/rs1/portfolio';
const asignacion = (org: string) => `/platform/organizations/${org}/reseller`;

interface Tab {
  assign: (org: string) => Promise<void>;
  remove: (row: PortfolioOrg) => Promise<void>;
  pickView: (view: string) => void;
}

describe('dba-portfolio-tab', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const montar = async (items = [cartera()]) => {
    const fixture = TestBed.createComponent(PortfolioTabComponent);
    fixture.componentRef.setInput('reseller', reseller());
    fixture.detectChanges();
    http.expectOne((r) => r.url === PORTFOLIO).flush({ total: items.length, items });
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('db-section-loader')).toBeNull();
    });
    let cambios = 0;
    fixture.componentInstance.changed.subscribe(() => (cambios += 1));
    return {
      fixture,
      host,
      tab: fixture.componentInstance as unknown as Tab,
      cambios: () => cambios,
    };
  };

  it('muestra plan, usuarios y estado; solo lectura sin acciones', async () => {
    conPermisos(['platform:commercial']);
    const { host } = await montar([
      cartera(),
      cartera({ id: 'o2', businessName: 'Sin Plan', plan: null, active: false }),
    ]);
    expect(host.textContent).toContain('Profesional');
    expect(host.textContent).toContain('3 / 5');
    expect(host.textContent).toContain('Sin plan');
    expect(host.textContent).toContain('Suspendida');
    expect(host.textContent).not.toContain('Asignar organización');
    expect(host.textContent).not.toContain('Quitar');
  });

  it('las vistas se traducen al filtro active del core', async () => {
    conPermisos(['platform:commercial']);
    const { tab } = await montar();
    tab.pickView('suspended');
    const req = http.expectOne((r) => r.url === PORTFOLIO);
    expect(req.request.params.get('active')).toBe('false');
    req.flush({ total: 0, items: [] });
  });

  it('asignar manda el reseller y avisa para refrescar el conteo', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    const { host, tab, cambios } = await montar();
    expect(host.textContent).toContain('Asignar organización');
    const accion = tab.assign('o7');
    const req = http.expectOne(asignacion('o7'));
    expect(req.request.body).toEqual({ resellerId: 'rs1' });
    req.flush({});
    const recarga = await vi.waitFor(() => http.expectOne((r) => r.url === PORTFOLIO));
    recarga.flush({ total: 0, items: [] });
    await accion;
    expect(cambios()).toBe(1);
  });

  it('quitar confirma y manda resellerId null', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    const confirmar = vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
    const { tab, cambios } = await montar();
    const accion = tab.remove(cartera());
    await vi.waitFor(() => expect(confirmar).toHaveBeenCalled());
    const req = await vi.waitFor(() => http.expectOne(asignacion('o1')));
    expect(req.request.body).toEqual({ resellerId: null });
    req.flush({});
    const recarga = await vi.waitFor(() => http.expectOne((r) => r.url === PORTFOLIO));
    recarga.flush({ total: 0, items: [] });
    await accion;
    expect(cambios()).toBe(1);
  });

  it('si el operador cancela no se llama al core', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(false);
    const { tab, cambios } = await montar();
    await tab.remove(cartera());
    http.expectNone(asignacion('o1'));
    expect(cambios()).toBe(0);
  });
});

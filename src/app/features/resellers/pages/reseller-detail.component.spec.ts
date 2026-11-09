import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { DialogService } from '../../../core/ui/dialog.service';
import { ResellerDetailComponent } from './reseller-detail.component';
import { cartera, conPermisos, configurar, movimiento, reseller } from './resellers-test-kit';

const BASE = '/platform/resellers/rs1';

interface Ficha {
  removeRole: () => Promise<void>;
  tab: { set: (tab: string) => void };
}

describe('Comercial › Resellers › ficha', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const montar = async (item = reseller()) => {
    const fixture = TestBed.createComponent(ResellerDetailComponent);
    fixture.componentRef.setInput('id', 'rs1');
    fixture.detectChanges();
    http.expectOne(BASE).flush(item);
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('dba-portfolio-tab')).not.toBeNull();
    });
    fixture.detectChanges();
    http.expectOne((r) => r.url === `${BASE}/portfolio`).flush({ total: 1, items: [cartera()] });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('dba-portfolio-tab dba-data-table')).not.toBeNull();
    });
    return { fixture, host, page: fixture.componentInstance as unknown as Ficha };
  };

  const quitarRol = (host: HTMLElement) =>
    [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Quitar rol'));

  it('solo lectura: sin quitar rol ni enlace a la organización sin clients', async () => {
    conPermisos(['platform:commercial']);
    const { host } = await montar();
    expect(host.textContent).toContain('Aliados SAS');
    expect(host.textContent).toContain('Notaría 14');
    expect(quitarRol(host)).toBeUndefined();
    expect(host.textContent).not.toContain('Ver organización');
    expect(host.textContent).not.toContain('Documentos firmados');
    expect(host.querySelector('dba-portfolio-tab a')).toBeNull();
  });

  it('con Inteligencia enlaza sus documentos firmados con el reseller elegido', async () => {
    conPermisos(['platform:commercial', 'platform:intelligence']);
    const { host } = await montar();
    const enlace = [...host.querySelectorAll('a')].find((a) =>
      a.textContent?.includes('Documentos firmados'),
    );
    expect(enlace?.getAttribute('href')).toBe('/inteligencia/documentos-reseller?reseller=rs1');
  });

  it('con clients enlaza la organización y la cartera', async () => {
    conPermisos(['platform:commercial', 'platform:clients']);
    const { host } = await montar();
    expect(host.textContent).toContain('Ver organización');
    expect(host.querySelector('dba-portfolio-tab a')?.textContent).toContain('Notaría 14');
  });

  it('con cartera, quitar rol se apaga y explica por qué', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    const { host } = await montar();
    expect(quitarRol(host)?.disabled).toBe(true);
    expect(host.textContent).toContain('Organizaciones en cartera: 2.');
  });

  it('sin cartera, quitar rol confirma, desmarca y vuelve a la lista', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { host, page } = await montar(reseller({ portfolioCount: 0 }));
    expect(quitarRol(host)?.disabled).toBe(false);
    const accion = page.removeRole();
    const req = await vi.waitFor(() => http.expectOne((r) => r.method === 'PUT'));
    expect(req.request.body).toEqual({ isReseller: false });
    req.flush(reseller({ isReseller: false, portfolioCount: 0 }));
    await accion;
    expect(navegar).toHaveBeenCalledWith(['/comercial/resellers']);
  });

  it('si el core responde que ya tiene cartera, refresca el conteo y no sale', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { fixture, host, page } = await montar(reseller({ portfolioCount: 0 }));
    const accion = page.removeRole();
    const req = await vi.waitFor(() => http.expectOne((r) => r.method === 'PUT'));
    req.flush({ code: 'RESELLER_CON_CARTERA' }, { status: 409, statusText: 'Conflict' });
    const refresco = await vi.waitFor(() => http.expectOne(BASE));
    refresco.flush(reseller({ portfolioCount: 1 }));
    await accion;
    fixture.detectChanges();
    expect(navegar).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Organizaciones en cartera: 1.');
  });

  it('una organización que ya no es reseller se ve como inexistente', async () => {
    conPermisos(['platform:commercial']);
    const fixture = TestBed.createComponent(ResellerDetailComponent);
    fixture.componentRef.setInput('id', 'rs1');
    fixture.detectChanges();
    http.expectOne(BASE).flush({ code: 'NO_ES_RESELLER' }, { status: 400, statusText: 'Bad' });
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain('Este reseller no existe');
    });
  });

  it('el historial cuenta qué pasó, quién y usa nombres', async () => {
    conPermisos(['platform:commercial']);
    const { fixture, host, page } = await montar();
    page.tab.set('history');
    fixture.detectChanges();
    const req = http.expectOne((r) => r.url === '/platform/resellers/history');
    expect(req.request.params.get('resellerId')).toBe('rs1');
    req.flush({
      total: 3,
      items: [
        movimiento(),
        movimiento({
          id: 'h2',
          previousResellerId: 'rs9',
          previousResellerName: 'Otros SAS',
          actorName: undefined,
        }),
        movimiento({
          id: 'h3',
          action: 'reseller.flag_set',
          organizationName: 'Aliados SAS',
        }),
      ],
    });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('dba-history-tab dba-data-table')).not.toBeNull();
    });
    expect(host.textContent).toContain('Notaría 14 entró a la cartera de Aliados SAS');
    expect(host.textContent).toContain('Notaría 14 pasó de Otros SAS a Aliados SAS');
    expect(host.textContent).toContain('Aliados SAS quedó marcada como reseller');
    expect(host.textContent).toContain('Sam Ventas');
    expect(host.textContent).toContain('Personal de plataforma');
  });
});

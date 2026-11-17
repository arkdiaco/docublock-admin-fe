import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
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

  const fila = (host: HTMLElement, etiqueta: string) => {
    const dt = [...host.querySelectorAll('.bd__dl dt')].find(
      (d) => d.textContent?.trim() === etiqueta,
    );
    return dt?.nextElementSibling as HTMLElement | undefined;
  };

  const boton = (host: HTMLElement, texto: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === texto,
    );

  const abrirModelo = async (
    fixture: { detectChanges: () => void },
    host: HTMLElement,
    texto: string,
  ) => {
    boton(host, texto)!.click();
    fixture.detectChanges();
    await vi.waitFor(() =>
      expect(host.querySelector('db-modal-shell dba-choice-list')).not.toBeNull(),
    );
    return host.querySelector('db-modal-shell') as HTMLElement;
  };

  describe('modelo comercial', () => {
    it('sin tipificar lo dice y explica qué ve el reseller; sin gestión no ofrece definirlo', async () => {
      conPermisos(['platform:commercial']);
      const { host } = await montar();
      const dd = fila(host, 'Modelo comercial')!;
      expect(dd.textContent).toContain('Sin tipificar');
      const notas = [...dd.querySelectorAll('.dba-meta')].map((n) => n.textContent?.trim());
      expect(notas).toEqual([
        'Sin tipificar',
        'Hasta definirlo, el reseller puede transferir documentos y asignar planes',
      ]);
      expect(boton(host, 'Definir modelo')).toBeUndefined();
      expect(boton(host, 'Cambiar modelo')).toBeUndefined();
    });

    it('tipificado muestra el modelo sin la nota y ofrece cambiarlo con el actual marcado', async () => {
      conPermisos(['platform:commercial', 'platform:commercial:manage']);
      const { fixture, host } = await montar(reseller({ model: 'PLANS' }));
      const dd = fila(host, 'Modelo comercial')!;
      expect(dd.textContent?.trim()).toBe('Planes prepagados');
      expect(boton(host, 'Definir modelo')).toBeUndefined();
      const modal = await abrirModelo(fixture, host, 'Cambiar modelo');
      expect(modal.textContent).toContain('¿Cómo opera este reseller?');
      const radios = modal.querySelectorAll<HTMLInputElement>('input[type="radio"]');
      expect([...radios].map((r) => r.checked)).toEqual([false, true]);
    });

    it('definir el modelo manda el PATCH con lo elegido, avisa y refresca la ficha', async () => {
      conPermisos(['platform:commercial', 'platform:commercial:manage']);
      const exito = vi.spyOn(TestBed.inject(NotificationService), 'success');
      const { fixture, host } = await montar();
      const modal = await abrirModelo(fixture, host, 'Definir modelo');
      expect(modal.textContent).toContain(
        'Transfiere documentos de su propia cuota a cada organización',
      );
      expect(modal.textContent).toContain(
        'Asigna a cada organización un plan prepagado; no transfiere de su cuota',
      );
      expect(boton(host, 'Guardar modelo')?.disabled).toBe(true);
      modal.querySelectorAll<HTMLInputElement>('input[type="radio"]')[0].click();
      fixture.detectChanges();
      boton(host, 'Guardar modelo')!.click();
      const req = await vi.waitFor(() => http.expectOne(`${BASE}/model`));
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ model: 'POOL' });
      req.flush(reseller({ model: 'POOL' }));
      const refresco = await vi.waitFor(() => http.expectOne(BASE));
      refresco.flush(reseller({ model: 'POOL' }));
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(host.querySelector('db-modal-shell')).toBeNull();
        expect(fila(host, 'Modelo comercial')?.textContent?.trim()).toBe('Bolsa propia');
      });
      expect(exito).toHaveBeenCalledWith('Aliados SAS quedó como Bolsa propia');
      expect(boton(host, 'Cambiar modelo')).toBeDefined();
    });

    it('si la organización dejó de ser reseller lo explica y deja el modal abierto', async () => {
      conPermisos(['platform:commercial', 'platform:commercial:manage']);
      const fallo = vi.spyOn(TestBed.inject(NotificationService), 'error');
      const { fixture, host } = await montar();
      const modal = await abrirModelo(fixture, host, 'Definir modelo');
      modal.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1].click();
      fixture.detectChanges();
      boton(host, 'Guardar modelo')!.click();
      const req = await vi.waitFor(() => http.expectOne(`${BASE}/model`));
      req.flush({ code: 'NO_ES_RESELLER' }, { status: 409, statusText: 'Conflict' });
      await vi.waitFor(() =>
        expect(fallo).toHaveBeenCalledWith('Esa organización ya no es reseller.'),
      );
      fixture.detectChanges();
      expect(host.querySelector('db-modal-shell')).not.toBeNull();
    });
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
      total: 4,
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
        movimiento({
          id: 'h4',
          action: 'reseller.model_set',
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
    expect(host.textContent).toContain('cambió el modelo comercial de Aliados SAS');
    expect(host.textContent).toContain('Sam Ventas');
    expect(host.textContent).toContain('Personal de plataforma');
  });
});

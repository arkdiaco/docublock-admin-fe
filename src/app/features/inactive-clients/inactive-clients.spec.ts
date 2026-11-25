import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  provideTranslateService,
  TranslateLoader,
  TranslateService,
  type TranslationObject,
} from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of, type Observable } from 'rxjs';
import { vi } from 'vitest';
import es from '../../../../public/i18n/es.json';
import { API_BASE_URL } from '../../core/config/api.tokens';
import type {
  InactiveOrganizationRow,
  InactiveOrganizationsPage,
} from './data/inactive-clients.models';
import { InactiveClientsComponent } from './pages/inactive-clients.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const fila = (over: Partial<InactiveOrganizationRow> = {}): InactiveOrganizationRow => ({
  organization: {
    id: 'org-1',
    businessName: 'Notaría Central',
    tributaryNumber: '900111',
    email: 'notaria@central.co',
    suspended: false,
  },
  lastActivityAt: '2026-04-12T15:00:00.000Z',
  lastDocumentAt: '2026-03-01T15:00:00.000Z',
  lastSignatureAt: '2026-04-12T15:00:00.000Z',
  documents: 4,
  signedDocuments: 3,
  monthsInactive: 7,
  plan: {
    code: 'PRO',
    name: 'Profesional',
    state: 'EXPIRED',
    periodEnd: '2026-06-30T05:00:00.000Z',
  },
  lastNotice: null,
  lastExport: null,
  ...over,
});

const pagina = (
  items: InactiveOrganizationRow[],
  over: Partial<InactiveOrganizationsPage> = {},
): InactiveOrganizationsPage => ({
  months: 6,
  cutoff: '2026-05-20T15:00:00.000Z',
  computedAt: '2026-11-20T08:00:00.000Z',
  total: items.length,
  items,
  ...over,
});

const texto = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('Clientes › Clientes inactivos', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
        provideTranslateService({
          loader: { provide: TranslateLoader, useClass: CatalogoEspanol },
          fallbackLang: 'es',
        }),
        { provide: API_BASE_URL, useValue: 'http://api.test/api/core' },
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  const montar = async (respuesta: InactiveOrganizationsPage) => {
    const fixture = TestBed.createComponent(InactiveClientsComponent);
    fixture.detectChanges();
    const req = http.expectOne((r) => r.url === '/platform/inactive-organizations');
    req.flush(respuesta);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement, req };
  };

  it('pide la primera página de 20 sin búsqueda', async () => {
    const { req } = await montar(pagina([fila()]));
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('limit')).toBe('20');
    expect(req.request.params.has('search')).toBe(false);
  });

  it('cada fila dice quién es, cuándo fue su última actividad, cuánto firmó, su plan y su correo', async () => {
    const { host } = await montar(pagina([fila()]));
    const row = texto(host.querySelector('.dba-tr'));
    expect(row).toContain('Notaría Central');
    expect(row).toContain('900111');
    expect(row).toContain('12/04/2026');
    expect(row).toContain('Hace 7 meses');
    expect(row).toContain('3 de 4');
    expect(row).toContain('Profesional');
    expect(row).toContain('Vencido');
    expect(row).toContain('notaria@central.co');
    expect(row).toContain('Activa');
  });

  it('marca la suspendida, la que no tiene plan ni correo y el singular de un mes', async () => {
    const { host } = await montar(
      pagina([
        fila({
          organization: {
            id: 'o2',
            businessName: 'Sin nada',
            tributaryNumber: '1',
            email: null,
            suspended: true,
          },
          plan: null,
          monthsInactive: 1,
          signedDocuments: 1,
          documents: 1,
        }),
      ]),
    );
    const row = texto(host.querySelector('.dba-tr'));
    expect(row).toContain('Suspendida');
    expect(row).toContain('Sin plan');
    expect(row).toContain('Hace 1 mes');
    expect(row).toContain('1 de 1');
    expect(row).not.toContain('null');
  });

  it('la franja dice cuántas hay, desde qué fecha y cuándo se calculó', async () => {
    const { host } = await montar(pagina([fila()], { total: 42 }));
    const band = texto(host.querySelector('db-stat-band'));
    expect(band).toContain('42');
    expect(band).toContain('20/05/2026');
    expect(band).toContain('20/11/2026');
  });

  it('busca por nombre, NIT o correo después de dejar de escribir y vuelve a la página 1', async () => {
    vi.useFakeTimers();
    const { fixture, host } = await montar(pagina([fila()]));
    const input = host.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = ' 900111 ';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(400);
    const req = http.expectOne((r) => r.url === '/platform/inactive-organizations');
    expect(req.request.params.get('search')).toBe('900111');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(pagina([fila()]));
    fixture.detectChanges();
  });

  it('al abrir una fila va al detalle de la organización', async () => {
    const { host } = await montar(pagina([fila()]));
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    (host.querySelector('.dba-tr') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/clientes/organizaciones', 'org-1']);
  });

  it('sin cálculo todavía lo dice y explica cuándo corre', async () => {
    const { host } = await montar(pagina([], { computedAt: null }));
    const panel = texto(host.querySelector('.inactive__panel'));
    expect(panel).toContain('Todavía no se ha calculado la actividad');
    expect(panel).toContain('3:00');
  });

  it('sin inactivas lo dice', async () => {
    const { host } = await montar(pagina([]));
    expect(texto(host.querySelector('.inactive__panel'))).toContain('No hay clientes inactivos');
  });

  it('si falla deja reintentar', async () => {
    const fixture = TestBed.createComponent(InactiveClientsComponent);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/platform/inactive-organizations')
      .flush('x', { status: 500, statusText: 'x' });
    await fixture.whenStable();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(texto(host)).toContain('No pudimos cargar los clientes inactivos');
    (host.querySelector('.inactive__panel button') as HTMLButtonElement).click();
    http.expectOne((r) => r.url === '/platform/inactive-organizations').flush(pagina([fila()]));
  });

  it('no deja llaves crudas en pantalla', async () => {
    const { host } = await montar(
      pagina([
        fila(),
        fila({ organization: { ...fila().organization, id: 'o3', suspended: true }, plan: null }),
      ]),
    );
    expect(texto(host)).not.toMatch(/\b(inactive|nav|common)\.[a-zA-Z.]+/);
  });
});

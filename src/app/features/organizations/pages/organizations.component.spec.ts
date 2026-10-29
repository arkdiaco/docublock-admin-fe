import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of, type Observable } from 'rxjs';
import es from '../../../../../public/i18n/es.json';
import { API_BASE_URL } from '../../../core/config/api.tokens';
import { OrganizationsComponent } from './organizations.component';
import type { PlatformOrgPage } from '../data/organizations.models';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const page = (overrides: Partial<PlatformOrgPage> = {}): PlatformOrgPage => ({
  total: 2,
  counts: { total: 2, active: 1, suspended: 0, expired: 1, no_subscription: 0 },
  items: [
    {
      id: 'org-1',
      businessName: 'Aeropuerto Sierra Norte',
      tributaryNumber: '900123456',
      countryName: 'Colombia',
      state: 'active',
      plan: { code: 'CORP', name: 'Corporativo' },
      periodEnd: '2027-01-01T00:00:00.000Z',
      documents: { used: 190, limit: 200 },
      members: 48,
      warning: true,
      isReseller: false,
      createdAt: '2024-03-14T00:00:00.000Z',
    },
    {
      id: 'org-2',
      businessName: 'Puerto de Valparaíso',
      tributaryNumber: '800987654',
      countryName: 'Chile',
      state: 'expired',
      plan: { code: 'CORP', name: 'Corporativo' },
      periodEnd: '2024-01-01T00:00:00.000Z',
      documents: { used: 10, limit: 100 },
      members: 77,
      warning: false,
      isReseller: false,
    },
  ],
  ...overrides,
});

describe('OrganizationsComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogoEspanol }, fallbackLang: 'es' }),
        { provide: API_BASE_URL, useValue: 'http://api.test/api/core' },
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const montar = async () => {
    const fixture = TestBed.createComponent(OrganizationsComponent);
    fixture.detectChanges();
    const req = http.expectOne((r) => r.url === '/platform/organizations');
    req.flush(page());
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement, req };
  };

  it('carga y pinta la tabla con las columnas, el estado por fila y los conteos en las píldoras', async () => {
    const { host } = await montar();
    expect(host.querySelectorAll('dba-data-table .dba-tr').length).toBe(2);
    expect(host.querySelector('.org-cell__name')?.textContent).toContain('Aeropuerto Sierra Norte');
    expect(host.querySelector('.org-cell__nit')?.textContent).toContain('900123456');
    expect(host.querySelector('.usage__value')?.textContent?.trim()).toBe('190 / 200');
    expect(host.querySelector('.st--active')?.textContent).toContain('Activa');
    expect(host.querySelector('.orgs__warn')).not.toBeNull();
    const pills = [...host.querySelectorAll('.pill')].map((p) => p.textContent?.replace(/\s+/g, ' ').trim());
    expect(pills[0]).toContain('Todas');
    expect(pills[1]).toContain('Activa');
    expect(host.querySelector('.tbl__range')?.textContent).toContain('1–2 de 2');
    expect(host.textContent).not.toMatch(/\b(orgs|org|nav|common|tbl)\.[a-zA-Z]/);
  });

  it('la fila vencida muestra su propio rótulo', async () => {
    const { host } = await montar();
    const estados = [...host.querySelectorAll('.orgs__state .st')].map((s) => s.textContent?.trim());
    expect(estados).toEqual(['Activa', 'Vencida']);
  });

  it('elegir un estado recarga pidiendo ese filtro desde la primera página', async () => {
    const { fixture, host } = await montar();
    host.querySelectorAll<HTMLButtonElement>('.pill')[1].click();
    const req = http.expectOne((r) => r.url === '/platform/organizations' && r.params.get('state') === 'active');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(page({ total: 1, items: [page().items[0]] }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelectorAll('dba-data-table .dba-tr').length).toBe(1);
  });

  it('exportar CSV pide el archivo con el filtro vigente', async () => {
    const { host } = await montar();
    host.querySelector<HTMLButtonElement>('[dba-button]')!.click();
    const req = http.expectOne((r) => r.url === '/platform/organizations/export.csv');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x'], { type: 'text/csv' }), {
      headers: { 'content-disposition': 'attachment; filename="organizaciones.csv"' },
    });
  });

  it('abrir una fila navega a la ficha', async () => {
    const { fixture, host } = await montar();
    const ir = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    host.querySelector<HTMLButtonElement>('dba-data-table .dba-tr')!.click();
    fixture.detectChanges();
    expect(ir).toHaveBeenCalledWith(['/clientes/organizaciones', 'org-1']);
  });

  it('sin resultados muestra el estado vacío honesto', async () => {
    const fixture = TestBed.createComponent(OrganizationsComponent);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/platform/organizations').flush(
      page({ total: 0, items: [], counts: { total: 0, active: 0, suspended: 0, expired: 0, no_subscription: 0 } }),
    );
    await fixture.whenStable();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('dba-empty-state')).not.toBeNull();
    expect(host.querySelector('dba-data-table')).toBeNull();
  });

  it('si dos búsquedas se cruzan, gana la última aunque la primera responda después', async () => {
    const { fixture, host } = await montar();
    host.querySelectorAll<HTMLButtonElement>('.pill')[1].click();
    host.querySelectorAll<HTMLButtonElement>('.pill')[0].click();
    const [vieja, nueva] = http.match((r) => r.url === '/platform/organizations');
    nueva.flush(page());
    await fixture.whenStable();
    vieja.flush(page({ total: 1, items: [page().items[0]] }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelectorAll('dba-data-table .dba-tr').length).toBe(2);
  });
});

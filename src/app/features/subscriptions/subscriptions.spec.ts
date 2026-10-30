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
import es from '../../../../public/i18n/es.json';
import { API_BASE_URL } from '../../core/config/api.tokens';
import type { SubscriptionRow, SubscriptionsPage } from './data/subscriptions.models';
import { SubscriptionsComponent } from './pages/subscriptions.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const row = (over: Partial<SubscriptionRow> = {}): SubscriptionRow => ({
  organization: {
    id: 'org-1',
    businessName: 'Aeropuerto',
    tributaryNumber: '900',
    countryId: 'co',
    isTest: false,
  },
  countryName: 'Colombia',
  subscription: {
    id: 's1',
    source: 'STRIPE',
    periodStart: '2026-01-01T00:00:00.000Z',
    periodEnd: '2026-11-03T00:00:00.000Z',
    daysLeft: 4,
  },
  plan: { code: 'CORE_10', name: 'Core 10', version: 2 },
  documents: { used: 190, limit: 200 },
  lastEndedAt: null,
  autoRenew: true,
  state: 'expiring',
  ...over,
});

const pagina = (items: SubscriptionRow[]): SubscriptionsPage => ({
  total: items.length,
  counts: { expiring: 2, expired: 1, none: 3, active: 9 },
  items,
});

describe('Comercial › Suscripciones', () => {
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

  afterEach(() => http.verify());

  const montar = async (items: SubscriptionRow[]) => {
    const fixture = TestBed.createComponent(SubscriptionsComponent);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/platform/plans')
      .flush([{ code: 'CORE_10', name: 'Core 10' }]);
    http.expectOne('/catalogs/countries').flush([{ id: 'co', name: 'Colombia' }]);
    const req = http.expectOne((r) => r.url === '/platform/subscriptions');
    req.flush(pagina(items));
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement, req };
  };

  it('arranca en «Por vencer» a 30 días, sin pruebas ni lo que renueva Stripe, y pinta conteos y filas', async () => {
    const { host, req } = await montar([
      row(),
      row({
        organization: {
          id: 'org-2',
          businessName: 'Fundación',
          tributaryNumber: '901',
          isTest: true,
        },
        subscription: null,
        plan: null,
        documents: null,
        autoRenew: false,
        lastEndedAt: '2026-09-20T00:00:00.000Z',
        state: 'none',
      }),
    ]);
    expect(req.request.params.get('state')).toBe('expiring');
    expect(req.request.params.get('days')).toBe('30');
    expect(req.request.params.has('includeTest')).toBe(false);
    expect(req.request.params.has('includeAutoRenew')).toBe(false);
    const pills = [...host.querySelectorAll('db-filter-pills')][0].textContent?.replace(
      /\s+/g,
      ' ',
    );
    expect(pills).toContain('Por vencer 2');
    expect(pills).toContain('Todas 15');
    const filas = [...host.querySelectorAll('dba-data-table .dba-tr')].map((r) =>
      r.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(filas[0]).toContain('Stripe');
    expect(filas[0]).toContain('Renueva sola');
    expect(filas[0]).toContain('en 4 días');
    expect(filas[0]).toContain('190 / 200');
    expect(filas[1]).toContain('Sin suscripción');
    expect(filas[1]).toContain('terminó el');
    expect(host.textContent).not.toMatch(/subs\./);
  });

  it('cambiar la ventana, incluir pruebas o lo de Stripe vuelve a pedir desde la página 1', async () => {
    const { fixture, host } = await montar([row()]);
    [...host.querySelectorAll('db-filter-pills')][1]
      .querySelectorAll<HTMLButtonElement>('button')[0]
      .click();
    let req = http.expectOne((r) => r.url === '/platform/subscriptions');
    expect(req.request.params.get('days')).toBe('7');
    req.flush(pagina([]));
    await fixture.whenStable();
    fixture.detectChanges();
    host.querySelector<HTMLLabelElement>('label[for=subs-include-test]')!.click();
    fixture.detectChanges();
    req = http.expectOne((r) => r.url === '/platform/subscriptions');
    expect(req.request.params.get('includeTest')).toBe('true');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(pagina([]));
  });

  it('cada fila abre la ficha en la pestaña Suscripción', async () => {
    const { host } = await montar([row()]);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    host.querySelector<HTMLButtonElement>('dba-data-table .dba-tr')!.click();
    expect(navegar).toHaveBeenCalledWith(['/clientes/organizaciones', 'org-1'], {
      queryParams: { tab: 'subscription' },
    });
  });

  it('el CSV usa el mismo filtro', async () => {
    const { fixture, host } = await montar([row()]);
    [...host.querySelectorAll<HTMLButtonElement>('button[dba-button]')]
      .find((b) => b.textContent?.includes('Exportar CSV'))!
      .click();
    fixture.detectChanges();
    const req = http.expectOne((r) => r.url === '/platform/subscriptions/export.csv');
    expect(req.request.params.get('state')).toBe('expiring');
    expect(req.request.params.has('page')).toBe(false);
    req.flush(new Blob(['x'], { type: 'text/csv' }), {
      headers: { 'content-disposition': 'attachment; filename="suscripciones.csv"' },
    });
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  provideTranslateService,
  TranslateLoader,
  TranslateService,
  type TranslationObject,
} from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../../public/i18n/es.json';
import { AuthStore } from '../../../core/auth/auth.store';
import type { PlatformDashboard } from '../data/dashboard.models';
import { OverviewComponent, greetingKeyOf } from './overview.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const ALL = [
  'platform:clients',
  'platform:clients:manage',
  'platform:operations',
  'platform:commercial',
  'platform:catalogs',
  'platform:platform',
];

const dashboard = (over: Partial<PlatformDashboard> = {}): PlatformDashboard => ({
  generatedAt: '2026-10-30T12:00:00.000Z',
  organizations: { total: 312, createdThisMonth: 6 },
  activeUsers: { last30Days: 4812 },
  revenue: { currency: 'COP', gross: 1_500_000, previousGross: 1_000_000, otherCurrencies: 0 },
  warnings: { total: 3, exhausted: 1 },
  actions: [
    {
      kind: 'QUOTA_EXHAUSTED',
      total: 1,
      items: [
        {
          organization: {
            id: 'o1',
            businessName: 'Puerto de Valparaíso',
            tributaryNumber: '900123',
          },
          used: 500,
          limit: 500,
        },
      ],
    },
    {
      kind: 'TICKET_OVERDUE',
      total: 2,
      items: [{ ticket: { id: 't', ticketNumber: 'SOP-1', subject: 'x' }, organization: null }],
    },
    {
      kind: 'SUBSCRIPTION_EXPIRING',
      total: 1,
      items: [
        {
          organization: { id: 'o2', businessName: 'Notaría 14', tributaryNumber: '800456' },
          daysLeft: 2,
          periodEnd: null,
        },
      ],
    },
  ],
  activity: [
    {
      id: '8f3a00000000000000c21d',
      action: 'organization.suspend',
      admin: { id: 'a', name: 'Marta Vidal' },
      target: { type: 'organization', id: 'o9' },
      organization: { id: 'o9', name: 'Textiles Herrera' },
      createdAt: '2026-10-29T16:42:00.000Z',
    },
    {
      id: 'e5d10000000000000077b2',
      action: 'algo.nuevo',
      admin: { id: 'b' },
      target: { type: 'x' },
      createdAt: '2026-10-28T09:00:00.000Z',
    },
  ],
  ...over,
});

describe('OverviewComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({
          loader: { provide: TranslateLoader, useClass: CatalogoEspanol },
          fallbackLang: 'es',
        }),
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const perfil = (permisos: string[]) =>
    TestBed.inject(AuthStore).setProfile({
      user: {
        id: 'u1',
        names: 'Marta Lucía',
        surNames: 'Vidal',
        email: 'm@d.co',
        identification: '1',
        imageProfile: null,
      },
      platformStaff: true,
      platformPermissions: permisos,
    });

  const montar = async (respuesta: PlatformDashboard | 'error') => {
    const fixture = TestBed.createComponent(OverviewComponent);
    fixture.detectChanges();
    const req = http.expectOne('/platform/dashboard');
    if (respuesta === 'error') req.flush({}, { status: 500, statusText: 'x' });
    else req.flush(respuesta);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  };

  it('el saludo depende de la hora', () => {
    expect(greetingKeyOf(8)).toBe('overview.greeting.morning');
    expect(greetingKeyOf(15)).toBe('overview.greeting.afternoon');
    expect(greetingKeyOf(21)).toBe('overview.greeting.evening');
  });

  it('pinta los cuatro indicadores con datos reales', async () => {
    perfil(ALL);
    const { host } = await montar(dashboard());
    expect(host.querySelector('h1')?.textContent).toMatch(/Buen[oa]s (días|tardes|noches), Marta$/);
    const values = [...host.querySelectorAll('.kpi__value')].map((v) => v.textContent?.trim());
    const deltas = [...host.querySelectorAll('.kpi__delta')].map((v) => v.textContent?.trim());
    expect(values[0]).toBe('312');
    expect(values[1]).toBe('4.812');
    expect(values[2]).toMatch(/1[.,]500[.,]000/);
    expect(values[3]).toBe('3');
    expect(deltas[0]).toBe('+6 este mes');
    expect(deltas[1]).toBe('últimos 30 días');
    expect(deltas[2]).toMatch(/^\+.*500[.,]000 vs\. \S+/);
    expect(deltas[3]).toBe('1 sin cupo');
    expect(host.textContent).not.toMatch(/\b(overview|nav|act|orgCreate|common)\.[a-zA-Z]/);
  });

  it('«Requiere acción» pinta cupos, tickets vencidos y suscripciones; el contador suma sus totales', async () => {
    perfil(ALL);
    const { host } = await montar(dashboard());
    const rows = [...host.querySelectorAll('dba-action-row')];
    expect(rows.length).toBe(3);
    expect(host.querySelector('.panel__count')?.textContent?.trim()).toBe('4');
    expect(rows[0].textContent).toContain('Puerto de Valparaíso');
    expect(rows[0].textContent).toContain('cupo de documentos agotado · 500 / 500');
    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe(
      '/clientes/organizaciones/o1?tab=quotas',
    );
    expect(rows[1].textContent).toContain('SOP-1');
    expect(rows[1].textContent).toContain('ticket vencido sin atender');
    expect(rows[1].querySelector('a')?.getAttribute('href')).toBe('/operacion/soporte/t?tab=sla');
    expect(rows[2].textContent).toContain('la suscripción vence en 2 días');
    expect(rows[2].querySelector('a')?.getAttribute('href')).toBe(
      '/clientes/organizaciones/o2?tab=subscription',
    );
    expect(host.textContent).not.toMatch(/\b(overview|nav|common)\.[a-zA-Z]/);
  });

  it('la actividad se lee como frase; lo desconocido sale con su código y sin llave cruda', async () => {
    perfil(ALL);
    const { host } = await montar(dashboard());
    const events = [...host.querySelectorAll('dba-audit-event')];
    expect(events.length).toBe(2);
    expect(events[0].textContent).toContain('Marta Vidal');
    expect(events[0].textContent).toContain('suspendió Textiles Herrera');
    expect(events[0].querySelector('.ev__meta')?.textContent).toContain('evt 8f3a…c21d');
    expect(events[1].textContent).toContain('Alguien del personal');
    expect(events[1].querySelector('code')?.textContent).toBe('algo.nuevo');
    expect(host.querySelector('.panel__link')?.getAttribute('href')).toBe('/plataforma/auditoria');
  });

  it('el indicador de ingresos lleva a Ingresos y los demás no son enlace', async () => {
    perfil(['platform:clients', 'platform:commercial']);
    const { host } = await montar(dashboard());
    const enlaces = host.querySelectorAll('.ov__kpiLink');
    expect(enlaces.length).toBe(1);
    expect(enlaces[0].getAttribute('href')).toBe('/comercial/facturacion/ingresos');
    expect(host.querySelectorAll('dba-kpi-card').length).toBe(4);
  });

  it('sin comercial ni plataforma: tres indicadores y sin panel de actividad', async () => {
    perfil(['platform:clients']);
    const { host } = await montar(dashboard({ revenue: null, activity: null }));
    expect(host.querySelectorAll('dba-kpi-card').length).toBe(3);
    expect(host.querySelector('.ov__kpis--three')).not.toBeNull();
    expect(host.querySelectorAll('dba-audit-event').length).toBe(0);
    expect(host.querySelector('.ov__panels--single')).not.toBeNull();
    expect(host.textContent).not.toContain('Crear organización');
  });

  it('con clients:manage ofrece crear organización desde la portada', async () => {
    perfil(ALL);
    const { host } = await montar(dashboard());
    const link = [...host.querySelectorAll('a[dba-button]')].find((a) =>
      a.textContent?.includes('Crear organización'),
    );
    expect(link?.getAttribute('href')).toBe('/clientes/organizaciones?nueva=1');
  });

  it('sin pendientes ni eventos, los dos paneles lo dicen con honestidad', async () => {
    perfil(ALL);
    const { host } = await montar(dashboard({ actions: [], activity: [] }));
    expect(host.querySelectorAll('dba-empty-state').length).toBe(2);
    expect(host.querySelector('.panel__count')?.textContent?.trim()).toBe('0');
  });

  it('si falla, ofrece reintentar y al reintentar vuelve a pedir', async () => {
    perfil(ALL);
    const { fixture, host } = await montar('error');
    expect(host.textContent).toContain('No pudimos cargar la visión general');
    (host.querySelector('.panel--error button') as HTMLButtonElement).click();
    http.expectOne('/platform/dashboard').flush(dashboard());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelectorAll('dba-kpi-card').length).toBe(4);
  });
});

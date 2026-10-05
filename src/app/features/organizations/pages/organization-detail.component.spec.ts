import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of, type Observable } from 'rxjs';
import es from '../../../../../public/i18n/es.json';
import { API_BASE_URL } from '../../../core/config/api.tokens';
import { OrganizationDetailComponent } from './organization-detail.component';
import type { PlatformOrgDetail } from '../data/organizations.models';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const detail = (over: Partial<PlatformOrgDetail> = {}): PlatformOrgDetail => ({
  id: 'org-1',
  businessName: 'Aeropuerto Sierra Norte',
  tributaryNumber: '900123456',
  type: 2,
  countryName: 'Colombia',
  email: 'hola@sierranorte.aero',
  state: 'active',
  isReseller: false,
  isTest: true,
  createdAt: '2024-03-14T00:00:00.000Z',
  plan: { code: 'CORP', name: 'Corporativo', source: 'MANUAL', periodStart: '2024-01-01T00:00:00.000Z', periodEnd: '2027-01-01T00:00:00.000Z' },
  documents: { used: 190, limit: 200 },
  members: 48,
  modules: ['pagares', 'bienes_raices'],
  ...over,
});

describe('OrganizationDetailComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
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

  const montar = async (body = detail()) => {
    const fixture = TestBed.createComponent(OrganizationDetailComponent);
    fixture.componentRef.setInput('id', 'org-1');
    fixture.detectChanges();
    http.expectOne('/platform/organizations/org-1').flush(body);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  };

  it('pinta la cabecera con nombre, estado y meta, y las nueve pestañas con Resumen activa', async () => {
    const { host } = await montar();
    expect(host.querySelector('.rec__name')?.textContent?.trim()).toBe('Aeropuerto Sierra Norte');
    expect(host.querySelector('.rec__card .st--active')?.textContent).toContain('Activa');
    expect(host.querySelector('.rec__meta')?.textContent).toContain('900123456');
    expect(host.querySelector('.rec__meta')?.textContent).toContain('Corporativo');
    expect(host.querySelectorAll('db-underline-tabs .tab').length).toBe(9);
    expect(host.querySelector('.tab--on')?.textContent).toContain('Resumen');
    expect(host.querySelector('.od__flag--test')?.textContent).toContain('Prueba');
  });

  it('el Resumen trae perfil, módulos contratados y el plan con su consumo', async () => {
    const { host } = await montar();
    expect(host.querySelector('.od__dl')?.textContent).toContain('900123456');
    expect(host.querySelector('.od__dl')?.textContent).toContain('Colombia');
    const switches = [...host.querySelectorAll('[role="switch"]')].map((s) => s.getAttribute('aria-checked'));
    expect(switches).toEqual(['true', 'false', 'true']);
    expect(host.querySelector('dba-quota-bar')?.textContent).toContain('190 / 200');
    expect(host.textContent).not.toMatch(/\b(orgd|org|nav|common)\.[a-zA-Z]/);
  });

  it('cambiar de pestaña muestra el placeholder honesto', async () => {
    const { fixture, host } = await montar();
    host.querySelectorAll<HTMLButtonElement>('db-underline-tabs .tab')[3].click();
    fixture.detectChanges();
    expect(host.querySelector('dba-empty-state')?.textContent).toContain('llega pronto');
    expect(host.querySelector('.od__cols')).toBeNull();
  });

  it('sin suscripción lo dice y no pinta el plan', async () => {
    const { host } = await montar(detail({ state: 'no_subscription', plan: undefined, documents: { used: 0, limit: null } }));
    expect(host.querySelector('.od__muted')?.textContent).toContain('Sin suscripción');
    expect(host.querySelector('dba-quota-bar')).toBeNull();
    expect(host.querySelector('.rec__card .st--closed')).not.toBeNull();
  });
});

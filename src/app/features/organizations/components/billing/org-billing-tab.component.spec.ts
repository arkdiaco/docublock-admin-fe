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
import es from '../../../../../../public/i18n/es.json';
import { AuthStore } from '../../../../core/auth/auth.store';
import type { PlatformOrgDetail } from '../../data/organizations.models';
import { OrgBillingTabComponent } from './org-billing-tab.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

describe('Ficha de organización › Facturación', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
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

  const conPermisos = (permisos: string[]) =>
    TestBed.inject(AuthStore).setProfile({
      user: {
        id: 'u1',
        names: 'Sam',
        surNames: 'Ventas',
        email: 's@x.co',
        identification: '',
        imageProfile: null,
      },
      platformStaff: true,
      platformPermissions: permisos,
    });

  const montar = async (conDatos = true) => {
    const fixture = TestBed.createComponent(OrgBillingTabComponent);
    fixture.componentRef.setInput('org', { id: 'o1', businessName: 'N14' } as PlatformOrgDetail);
    fixture.detectChanges();
    const pagos = http.expectOne((r) => r.url === '/platform/transactions');
    const facturas = http.expectOne((r) => r.url === '/platform/invoices');
    expect(pagos.request.params.get('organizationId')).toBe('o1');
    expect(pagos.request.params.get('limit')).toBe('5');
    expect(facturas.request.params.get('organizationId')).toBe('o1');
    pagos.flush({
      total: conDatos ? 1 : 0,
      items: conDatos
        ? [
            {
              id: 'tx1',
              idTransaction: 'A',
              planName: 'Profesional',
              amountMajor: 1000,
              currency: 'COP',
              status: 'APPROVED',
              requestDate: '2026-10-29T10:00:00.000Z',
            },
          ]
        : [],
    });
    facturas.flush({
      total: conDatos ? 1 : 0,
      items: conDatos
        ? [{ id: 'f1', invoiceNumber: 'FAC-1', total: 1190, currency: 'COP', status: 'sent' }]
        : [],
    });
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('.ob__cols')).not.toBeNull();
    });
    return host;
  };

  it('muestra los últimos pagos y facturas con sus enlaces', async () => {
    conPermisos(['platform:commercial']);
    const host = await montar();
    expect(host.textContent).toContain('Profesional');
    expect(host.textContent).toContain('Aprobada');
    expect(host.textContent).toContain('FAC-1');
    expect(host.textContent).toContain('Enviada');
    expect(host.textContent).toContain('Ver todas las facturas');
    expect(host.textContent).not.toContain('Registrar pago manual');
  });

  it('con gestión y clientes ofrece registrar el pago', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage', 'platform:clients']);
    const host = await montar(false);
    expect(host.textContent).toContain('Registrar pago manual');
    expect(host.textContent).toContain('Esta organización no tiene transacciones.');
    expect(host.textContent).toContain('Esta organización no tiene facturas.');
  });
});

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
import { MessageService } from 'primeng/api';
import { of, type Observable } from 'rxjs';
import es from '../../../../../public/i18n/es.json';
import type { AuditPage } from '../data/audit.models';
import { AuditComponent } from './audit.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const MARTA = {
  id: '65a000000000000000000001',
  email: 'marta.vidal@docublock.co',
  name: 'Marta Vidal',
};
const ORG = '65a0000000000000000000aa';

const PAGINA: AuditPage = {
  total: 2,
  items: [
    {
      id: 'evt-1',
      action: 'staff.update',
      admin: MARTA,
      target: { type: 'platform_admin', id: '65a000000000000000000002' },
      reason: 'Cambio de área',
      before: undefined,
      after: { body: { role: 'readonly' } },
      ip: '181.49.12.7',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/141.0',
      createdAt: '2026-10-28T16:42:08.000Z',
    },
    {
      id: 'evt-2',
      action: 'organizations.export',
      admin: MARTA,
      target: { type: 'organization', id: ORG },
      organization: { id: ORG, name: 'Sierra Norte' },
      createdAt: '2026-10-28T16:41:50.000Z',
    },
  ],
};

describe('AuditComponent', () => {
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
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const montar = async () => {
    const fixture = TestBed.createComponent(AuditComponent);
    fixture.detectChanges();
    const req = http.expectOne((r) => r.url === '/platform/audit');
    req.flush(PAGINA);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement, req };
  };

  const filas = (host: HTMLElement) => host.querySelectorAll('.term__row:not(.term__row--head)');

  it('arranca en las últimas 24 h y pinta cada evento en el panel oscuro con hora UTC', async () => {
    const { host, req } = await montar();
    const desde = new Date(req.request.params.get('from')!).getTime();
    expect(Date.now() - desde).toBeGreaterThan(23.9 * 3_600_000);
    expect(Date.now() - desde).toBeLessThan(24.1 * 3_600_000);
    expect(host.textContent).toContain('últimas 24 h · 2 eventos');
    const primera = filas(host)[0];
    expect(primera.querySelector('.term__time')?.textContent?.trim()).toBe('28/10 16:42:08');
    expect(primera.querySelector('.term__actor')?.textContent?.trim()).toBe('marta.vidal');
    expect(primera.textContent).toContain('staff.update');
    expect(primera.textContent).toContain('· Cambio de área');
    expect(filas(host)[1].querySelector('.term__object')?.textContent?.trim()).toBe('Sierra Norte');
    expect(host.textContent).not.toMatch(/\b(audit|nav|common|tbl)\.[a-zA-Z]/);
  });

  it('abrir un evento muestra actor, motivo, dispositivo y el después', async () => {
    const { fixture, host } = await montar();
    (filas(host)[0] as HTMLElement).click();
    fixture.detectChanges();
    const detalle = host.querySelector('.term__detail')!;
    expect(detalle.textContent).toContain('Marta Vidal · marta.vidal@docublock.co');
    expect(detalle.textContent).toContain('Chrome · macOS');
    expect(detalle.textContent).toContain('"role": "readonly"');
    expect(detalle.textContent).not.toContain('Antes');
  });

  it('el filtro por llaves resuelve al actor y pide con esos filtros', async () => {
    const { fixture, host } = await montar();
    const campo = host.querySelector<HTMLInputElement>('.query__input')!;
    campo.value = 'actor:marta.vidal accion:staff';
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    http.expectOne('/platform/audit/facets').flush({ actions: ['staff.update'], admins: [MARTA] });
    await vi.waitFor(() => {
      const req = http.expectOne((r) => r.url === '/platform/audit');
      expect(req.request.params.get('adminId')).toBe(MARTA.id);
      expect(req.request.params.get('action')).toBe('staff');
      expect(req.request.params.get('page')).toBe('1');
      req.flush(PAGINA);
    });
    await fixture.whenStable();
  });

  it('una llave que no entiende se dice en pantalla y no pide nada', async () => {
    const { fixture, host } = await montar();
    const campo = host.querySelector<HTMLInputElement>('.query__input')!;
    campo.value = 'hola';
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    http.expectOne('/platform/audit/facets').flush({ actions: [], admins: [] });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('.audit__problems')?.textContent).toContain('No entiendo «hola»');
    });
  });

  it('clic en la organización de un evento filtra por ella', async () => {
    const { host } = await montar();
    host.querySelectorAll<HTMLButtonElement>('.term__object')[1].click();
    http.expectOne('/platform/audit/facets').flush({ actions: [], admins: [] });
    await vi.waitFor(() => {
      const req = http.expectOne((r) => r.url === '/platform/audit');
      expect(req.request.params.get('organizationId')).toBe(ORG);
      req.flush(PAGINA);
    });
    expect(host.querySelector<HTMLInputElement>('.query__input')!.value).toBe(`org:${ORG}`);
  });

  it('exportar pide el CSV con el periodo vigente', async () => {
    const { host } = await montar();
    [...host.querySelectorAll<HTMLButtonElement>('button[dba-button]')]
      .find((b) => b.textContent?.includes('Exportar CSV'))!
      .click();
    const req = http.expectOne((r) => r.url === '/platform/audit/export.csv');
    expect(req.request.params.get('from')).not.toBeNull();
    expect(req.request.params.get('page')).toBeNull();
    req.flush(new Blob(['x'], { type: 'text/csv' }), {
      headers: { 'content-disposition': 'attachment; filename="bitacora.csv"' },
    });
  });
});

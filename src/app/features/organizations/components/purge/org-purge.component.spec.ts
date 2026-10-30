import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  provideTranslateService,
  TranslateLoader,
  TranslateService,
  type TranslationObject,
} from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of, type Observable } from 'rxjs';
import es from '../../../../../../public/i18n/es.json';
import type { PlatformOrgDetail } from '../../data/organizations.models';
import { OrgPurgeComponent } from './org-purge.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const ORG = {
  id: 'org-1',
  businessName: 'Pruebas SAS',
  tributaryNumber: '900123',
  isTest: true,
} as PlatformOrgDetail;
const PREVIEW = {
  organizationId: 'org-1',
  businessName: 'Pruebas SAS',
  tributaryNumber: '900123',
  total: 6,
  groups: [
    {
      group: 'operation',
      total: 4,
      targets: [{ collection: 'documents', mode: 'delete', count: 4 }],
    },
    { group: 'consumption', total: 0, targets: [] },
    { group: 'membership', total: 2, targets: [{ collection: 'users', mode: 'pull', count: 2 }] },
  ],
  kept: ['organization'],
  previewToken: 't'.repeat(64),
};

describe('OrgPurgeComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrgPurgeComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
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

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  const montar = async () => {
    const fixture = TestBed.createComponent(OrgPurgeComponent);
    fixture.componentRef.setInput('org', ORG);
    const purged = vi.fn();
    fixture.componentInstance.purged.subscribe(purged);
    fixture.detectChanges();
    http.expectOne('/platform/organizations/org-1/purge/preview').flush(PREVIEW);
    await fixture.whenStable();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const go = () => host.querySelector<HTMLButtonElement>('.foot__go')!;
    const escribir = (indice: number, valor: string) => {
      const campo = host.querySelectorAll<HTMLInputElement>('.field__input')[indice];
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, host, go, escribir, purged };
  };

  it('exige el NIT, la frase exacta y el motivo antes de purgar', async () => {
    const { fixture, host, go, escribir } = await montar();
    go().click();
    fixture.detectChanges();

    expect(host.textContent).toContain('Escribe exactamente «PURGAR 900123».');
    expect(go().textContent?.trim()).toBe('Purgar ahora');
    expect(go().disabled).toBe(true);
    escribir(0, '900123');
    escribir(1, 'purgar 900123');
    escribir(2, 'Limpiar la demo');
    expect(go().disabled).toBe(true);
    expect(host.textContent).toContain('No coincide con la frase pedida.');
    escribir(1, 'PURGAR 900123');
    expect(go().disabled).toBe(false);
  });

  it('lanza la purga con la huella, sigue el trabajo y muestra el informe', async () => {
    const { fixture, host, go, escribir, purged } = await montar();
    vi.useFakeTimers();
    go().click();
    fixture.detectChanges();
    escribir(0, '900123');
    escribir(1, 'PURGAR 900123');
    escribir(2, 'Limpiar la demo');
    go().click();

    const req = http.expectOne(
      (r) => r.method === 'POST' && r.url === '/platform/organizations/org-1/purge',
    );
    expect(req.request.body).toEqual({
      previewToken: 't'.repeat(64),
      tributaryNumber: '900123',
      phrase: 'PURGAR 900123',
      reason: 'Limpiar la demo',
    });
    req.flush({ id: 'job-1', organizationId: 'org-1', state: 'running', report: [] });
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(host.textContent).toContain('Purgando por lotes');

    await vi.advanceTimersByTimeAsync(2000);
    http
      .expectOne('/platform/organizations/org-1/purge/jobs/job-1')
      .flush({ id: 'job-1', organizationId: 'org-1', state: 'running', report: [] });
    await vi.advanceTimersByTimeAsync(2000);
    http.expectOne('/platform/organizations/org-1/purge/jobs/job-1').flush({
      id: 'job-1',
      organizationId: 'org-1',
      state: 'done',
      report: [
        { collection: 'documents', group: 'operation', mode: 'delete', count: 4 },
        { collection: 'users', group: 'membership', mode: 'pull', count: 3 },
      ],
    });
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();

    expect(purged).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('La purga terminó.');
    expect(host.querySelector('.foot__go')?.textContent?.trim()).toBe('Cerrar');
    expect(host.querySelector('.foot__ghost')).toBeNull();
    expect([...host.querySelectorAll('.pp__count')].map((c) => c.textContent?.trim())).toEqual([
      '4',
      '3',
    ]);
    expect(host.textContent).not.toMatch(/purge\./);
  });

  it('si la vista previa venció, avisa y la vuelve a pedir', async () => {
    const { fixture, go, escribir } = await montar();
    const avisos = vi.spyOn(TestBed.inject(MessageService), 'add');
    go().click();
    fixture.detectChanges();
    escribir(0, '900123');
    escribir(1, 'PURGAR 900123');
    escribir(2, 'x');
    go().click();
    http
      .expectOne((r) => r.method === 'POST')
      .flush(
        { code: 'PURGA_VISTA_VENCIDA', message: 'x' },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();

    expect(avisos.mock.calls.map(([m]) => m.detail)).toEqual([
      'Los datos cambiaron desde la vista previa. Revísala de nuevo antes de purgar.',
    ]);
    http.expectOne('/platform/organizations/org-1/purge/preview').flush(PREVIEW);
  });
});

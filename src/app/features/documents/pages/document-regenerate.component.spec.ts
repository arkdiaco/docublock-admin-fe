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
import { AuthStore } from '../../../core/auth/auth.store';
import { API_BASE_URL } from '../../../core/config/api.tokens';
import { DialogService } from '../../../core/ui/dialog.service';
import type { PlatformDocumentSummary } from '../data/documents.models';
import { DocumentRegenerateComponent } from './document-regenerate.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const doc = (id: string): PlatformDocumentSummary => ({
  id,
  name: `Contrato ${id}`,
  code: `CT-${id}`,
  kind: 'WEB',
  organization: { id: 'o1', businessName: 'Notaría 14' },
  status: { progress: 3, state: 0, label: '' },
  signedCount: 1,
  signerCount: 1,
  anchored: false,
});

describe('Operación › Documentos › regenerar en lote', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
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
    http.verify();
    vi.useRealTimers();
  });

  const conPermisos = (permisos: string[]) =>
    TestBed.inject(AuthStore).setProfile({
      user: {
        id: 'u1',
        names: 'Marta',
        surNames: 'Vidal',
        email: 'marta@docublock.co',
        identification: '',
        imageProfile: null,
      },
      platformStaff: true,
      platformPermissions: permisos,
    });

  it('sin gestionar operaciones no ofrece el lote', () => {
    conPermisos(['platform:operations']);
    const fixture = TestBed.createComponent(DocumentRegenerateComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('dba-empty-state')?.textContent).toContain(
      'Sin permiso para regenerar',
    );
    expect(host.querySelector('input')).toBeNull();
  });

  it('busca firmados, arma el lote, regenera y deja en el lote solo los que fallaron', async () => {
    conPermisos(['platform:operations', 'platform:operations:manage']);
    const fixture = TestBed.createComponent(DocumentRegenerateComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const input = host.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = 'contrato';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(400);
    const req = http.expectOne((r) => r.url === '/platform/documents');
    expect(req.request.params.getAll('progress')).toEqual(['3']);
    expect(req.request.params.get('search')).toBe('contrato');
    req.flush({ total: 2, items: [doc('a'), doc('b')] });
    await fixture.whenStable();
    fixture.detectChanges();
    host
      .querySelectorAll<HTMLButtonElement>('.rg__cols section [aria-label="Agregar al lote"]')
      .forEach((b) => b.click());
    fixture.detectChanges();
    expect(host.querySelector('aside')?.textContent).toContain('2 de 100');
    vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
    [...host.querySelectorAll<HTMLButtonElement>('aside button')]
      .find((b) => b.textContent?.includes('Regenerar 2'))!
      .click();
    let run!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      run = http.expectOne(
        (r) => r.method === 'POST' && r.url === '/platform/documents/regenerate',
      );
    });
    expect(run.request.body).toEqual({ ids: ['a', 'b'] });
    run.flush({
      processed: 2,
      ok: 1,
      skipped: 0,
      failed: 1,
      results: [
        { id: 'a', name: 'Contrato a', status: 'ok' },
        { id: 'b', name: 'Contrato b', status: 'error', message: 'almacenamiento caído' },
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector('aside')?.textContent).toContain('1 de 100');
    expect(host.textContent).toContain('1 regenerado(s), 1 con error, 0 omitido(s)');
    expect(host.textContent).toContain('almacenamiento caído');
    expect(host.textContent).not.toMatch(/\b(docs|nav|common)\.[a-zA-Z]/);
  });
});

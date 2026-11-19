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
import type { PlatformDocumentSummary } from '../data/documents.models';
import { DocumentsComponent } from './documents.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const doc = (id: string, over: Partial<PlatformDocumentSummary> = {}): PlatformDocumentSummary => ({
  id,
  name: `Contrato ${id}`,
  code: `CT-${id}`,
  kind: 'WEB',
  organization: { id: 'o1', businessName: 'Notaría 14' },
  status: { progress: 3, state: 0, label: '' },
  signedCount: 1,
  signerCount: 1,
  anchored: false,
  ...over,
});

const emptyBucket = { total: 0, documents: [] };

describe('Operación › Documentos › lista', () => {
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
      platformPermissions: ['platform:operations'],
    });
  });

  afterEach(() => http.verify());

  it('la fila dice el radicado, o que se asigna al cerrar, y el buscador lo anuncia', async () => {
    const fixture = TestBed.createComponent(DocumentsComponent);
    fixture.detectChanges();
    http
      .expectOne('/platform/documents/issues')
      .flush({ unregisteredBlockchain: emptyBucket, stuckCompleted: emptyBucket });
    http
      .expectOne((r) => r.url === '/platform/documents')
      .flush({
        total: 3,
        items: [
          doc('a', { filing: { requested: true, number: 'NT-2026-000123' } }),
          doc('b', { filing: { requested: true } }),
          doc('c'),
        ],
      });
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelectorAll('.doc-row')).toHaveLength(3);
    });
    const rows = [...host.querySelectorAll<HTMLElement>('.doc-row')].map(
      (row) => row.querySelector('.dba-td')?.textContent ?? '',
    );
    expect(rows[0]).toContain('Radicado NT-2026-000123');
    expect(rows[1]).toContain('Radicado: se asigna al cerrar');
    expect(rows[2]).not.toContain('Radicado');
    expect(host.querySelector('input[type="search"]')?.getAttribute('placeholder')).toBe(
      'Busca por nombre, código o radicado',
    );
    expect(host.textContent).not.toMatch(/\b(docs|nav|common)\.[a-zA-Z]/);
  });
});

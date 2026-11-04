import { TestBed } from '@angular/core/testing';
import {
  provideTranslateService,
  TranslateLoader,
  TranslateService,
  type TranslationObject,
} from '@ngx-translate/core';
import { of, throwError, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { TargetHistoryComponent, type TargetHistoryLoader } from './target-history.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const EVENTO = {
  id: 'e1',
  action: 'signers.organization_add',
  admin: { id: 'a1', name: 'Sam' },
  organization: { id: 'o1', name: 'Notaría Central' },
  reason: 'Pedido',
};

describe('TargetHistoryComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideTranslateService({
          loader: { provide: TranslateLoader, useClass: CatalogoEspanol },
          fallbackLang: 'es',
        }),
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
  });

  const abrir = async (load: TargetHistoryLoader, texto: string): Promise<HTMLElement> => {
    const fixture = TestBed.createComponent(TargetHistoryComponent);
    fixture.componentRef.setInput('load', load);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain(texto);
    });
    return host;
  };

  it('nombra la acción, la organización y el motivo sin llaves crudas', async () => {
    const host = await abrir(
      () => of({ total: 1, items: [EVENTO] }),
      'vinculó a un firmante a Notaría Central',
    );
    expect(host.textContent).toContain('«Pedido»');
    expect(host.textContent).not.toMatch(/\b(act|hist)\.[a-z]/);
  });

  it('sin eventos lo explica', async () => {
    await abrir(() => of({ total: 0, items: [] }), 'Sin cambios registrados.');
  });

  it('un fallo ofrece reintentar', async () => {
    const host = await abrir(
      () => throwError(() => new Error('caído')),
      'No pudimos cargar el historial.',
    );
    expect(host.querySelector('button')).not.toBeNull();
  });
});

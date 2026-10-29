import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import {
  provideTranslateService,
  TranslateLoader,
  TranslateService,
  type TranslationObject,
} from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { DialogHostComponent } from './dialog-host.component';
import { DialogService } from './dialog.service';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

describe('DialogHostComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DialogHostComponent],
      deferBlockBehavior: DeferBlockBehavior.Playthrough,
      providers: [
        provideTranslateService({
          loader: { provide: TranslateLoader, useClass: CatalogoEspanol },
          fallbackLang: 'es',
        }),
      ],
    }).compileComponents();
  });

  it('no pinta nada hasta que el servicio abre, y confirmar resuelve la promesa', async () => {
    TestBed.inject(TranslateService).use('es');
    const fixture = TestBed.createComponent(DialogHostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('db-dialog')).toBeNull();

    const dialogos = TestBed.inject(DialogService);
    const pendiente = dialogos.confirm({
      title: 'Cerrar sesión',
      message: '¿Seguro?',
      confirmLabel: 'Cerrar',
    });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('db-dialog')).not.toBeNull();
    });
    expect(host.textContent).toContain('Cerrar sesión');

    const botones = [...host.querySelectorAll<HTMLButtonElement>('button')];
    botones.find((b) => b.textContent?.trim() === 'Cerrar')!.click();
    fixture.detectChanges();

    await expect(pendiente).resolves.toBe(true);
    expect(host.querySelector('db-dialog')).toBeNull();
  });
});

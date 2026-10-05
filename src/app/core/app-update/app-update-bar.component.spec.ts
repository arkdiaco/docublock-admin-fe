import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { HardNavigation } from '../browser/hard-navigation';
import { AppUpdateBarComponent } from './app-update-bar.component';
import { CURRENT_BUILD, LatestBuild } from './latest-build';
import { AppUpdate } from './app-update.service';

class Catalogo implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

describe('AppUpdateBarComponent', () => {
  it('no se ve hasta que hay versión nueva; «Actualizar» recarga', async () => {
    const navigation = { to: vi.fn(), reload: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AppUpdateBarComponent],
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: Catalogo }, fallbackLang: 'es' }),
        { provide: CURRENT_BUILD, useValue: 'AAAA1111' },
        { provide: LatestBuild, useValue: { id: () => Promise.resolve('BBBB2222') } },
        { provide: HardNavigation, useValue: navigation },
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
    const fixture = TestBed.createComponent(AppUpdateBarComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.upd')).toBeNull();
    await TestBed.inject(AppUpdate).check();
    fixture.detectChanges();
    expect(host.querySelector('.upd__text')?.textContent?.trim()).toBe('Hay una versión nueva de Docublock.');
    host.querySelector<HTMLButtonElement>('.upd__cta')!.click();
    expect(navigation.reload).toHaveBeenCalledTimes(1);
  });
});

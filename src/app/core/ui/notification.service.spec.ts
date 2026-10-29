import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { NotificationService } from './notification.service';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

describe('NotificationService', () => {
  let notify: NotificationService;
  let messages: MessageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MessageService, provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogoEspanol }, fallbackLang: 'es' })],
    });
    TestBed.inject(TranslateService).use('es');
    notify = TestBed.inject(NotificationService);
    messages = TestBed.inject(MessageService);
  });

  it('un acierto sale con severidad success y el texto en el detalle', () => {
    const spy = vi.spyOn(messages, 'add');
    notify.success('Guardado');
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Listo', detail: 'Guardado' }),
    );
  });

  it('un fallo sale con severidad error', () => {
    const spy = vi.spyOn(messages, 'add');
    notify.error('Se rompió');
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Se rompió' }),
    );
  });

  it('un informativo sale con severidad info', () => {
    const spy = vi.spyOn(messages, 'add');
    notify.info('Ojo con esto');
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'info', detail: 'Ojo con esto' }),
    );
  });

  it('todos los avisos se desvanecen solos', () => {
    const spy = vi.spyOn(messages, 'add');
    notify.success('a');
    notify.error('b');
    notify.info('c');
    for (const call of spy.mock.calls) {
      expect(call[0].life).toBeGreaterThan(0);
    }
  });

  it('se pueden limpiar todos de golpe', () => {
    const spy = vi.spyOn(messages, 'clear');
    notify.clear();
    expect(spy).toHaveBeenCalled();
  });
});

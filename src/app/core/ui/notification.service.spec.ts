import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let notify: NotificationService;
  let messages: MessageService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MessageService] });
    notify = TestBed.inject(NotificationService);
    messages = TestBed.inject(MessageService);
  });

  it('un acierto sale con severidad success y el texto en el detalle', () => {
    const spy = vi.spyOn(messages, 'add');
    notify.success('Guardado');
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', detail: 'Guardado' }),
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

import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { DialogService } from './dialog.service';

const traductorFalso = {
  instant: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
} as unknown as TranslateService;

describe('DialogService', () => {
  let dialogs: DialogService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: traductorFalso }],
    });
    dialogs = TestBed.inject(DialogService);
    document.body.style.overflow = '';
  });

  it('mientras no se pida nada no hay diálogo montado', () => {
    expect(dialogs.request()).toBeNull();
  });

  it('resuelve true cuando el usuario confirma', async () => {
    const promesa = dialogs.confirm({ title: 'T', confirmLabel: 'Hacerlo' });
    expect(dialogs.request()?.title).toBe('T');
    dialogs.close({ answer: 'confirm' });
    await expect(promesa).resolves.toBe(true);
  });

  it('resuelve false cuando el usuario cancela', async () => {
    const promesa = dialogs.confirm({ title: 'T', confirmLabel: 'Hacerlo' });
    dialogs.close({ answer: 'cancel' });
    await expect(promesa).resolves.toBe(false);
  });

  it('la segunda acción de una alerta no cuenta como confirmar', async () => {
    const promesa = dialogs.confirm({ title: 'T', confirmLabel: 'Hacerlo' });
    dialogs.close({ answer: 'secondary' });
    await expect(promesa).resolves.toBe(false);
  });

  it('bloquea el scroll del fondo mientras está abierto y lo devuelve al cerrar', () => {
    void dialogs.open({ title: 'T', confirmLabel: 'Hacerlo' });
    expect(document.body.style.overflow).toBe('hidden');
    dialogs.close({ answer: 'cancel' });
    expect(document.body.style.overflow).toBe('');
    expect(dialogs.request()).toBeNull();
  });

  it('confirmDelete nombra la acción con el número, no con un "Aceptar"', () => {
    void dialogs.confirmDelete(3);
    const peticion = dialogs.request();
    expect(peticion?.intent).toBe('danger');
    expect(peticion?.icon).toBe('trash');
    expect(peticion?.confirmLabel).toBe('dialog.deleteConfirm:{"count":3}');
  });

  it('status siempre monta la anatomía de alerta', () => {
    void dialogs.status({ title: 'Documento firmado', confirmLabel: 'Ver documento' });
    expect(dialogs.request()?.layout).toBe('status');
  });

  it('no abre ningún diálogo del navegador', () => {
    const nativo = vi.spyOn(globalThis, 'confirm');
    void dialogs.confirm({ title: 'T', confirmLabel: 'Hacerlo' });
    expect(nativo).not.toHaveBeenCalled();
  });
});

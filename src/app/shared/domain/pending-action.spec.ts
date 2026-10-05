import { PendingAction } from './pending-action';

describe('PendingAction', () => {
  it('marca la acción mientras corre y la suelta al terminar, también si falla', async () => {
    const pending = new PendingAction();
    let soltar: (value: string) => void = () => undefined;
    const trabajo = pending.run('cancel', () => new Promise<string>((resolve) => (soltar = resolve)));
    expect(pending.key()).toBe('cancel');
    soltar('listo');
    await expect(trabajo).resolves.toBe('listo');
    expect(pending.key()).toBeNull();

    await expect(pending.run('portal', () => Promise.reject(new Error('caído')))).rejects.toThrow('caído');
    expect(pending.key()).toBeNull();
  });

  it('una acción que termina no borra la que empezó después', async () => {
    const pending = new PendingAction();
    let primera: () => void = () => undefined;
    const uno = pending.run('a', () => new Promise<void>((resolve) => (primera = resolve)));
    const dos = pending.run('b', () => new Promise<void>(() => undefined));
    primera();
    await uno;
    expect(pending.key()).toBe('b');
    void dos;
  });
});

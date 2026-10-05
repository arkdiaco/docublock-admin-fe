import { signal } from '@angular/core';

export class PendingAction {
  private readonly _key = signal<string | null>(null);

  readonly key = this._key.asReadonly();

  async run<T>(key: string, work: () => Promise<T>): Promise<T> {
    this._key.set(key);
    try {
      return await work();
    } finally {
      if (this._key() === key) this._key.set(null);
    }
  }
}

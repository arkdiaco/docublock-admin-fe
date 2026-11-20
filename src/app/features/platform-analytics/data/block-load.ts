import { signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { LatestRequest } from '../../../shared/http/latest-request';

export type LoadState = 'loading' | 'ready' | 'failed';

export class BlockLoad<T> {
  readonly state = signal<LoadState>('loading');
  readonly data = signal<T | null>(null);
  private readonly latest = new LatestRequest();

  cancel(): void {
    this.latest.start();
  }

  async run(request: () => Observable<T>): Promise<void> {
    const current = this.latest.start();
    this.state.set('loading');
    try {
      const data = await firstValueFrom(request());
      if (!current()) return;
      this.data.set(data);
      this.state.set('ready');
    } catch {
      if (current()) this.state.set('failed');
    }
  }
}

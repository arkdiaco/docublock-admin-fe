import { Injectable, signal } from '@angular/core';
import type { ConsoleArea } from './console-nav';

@Injectable({ providedIn: 'root' })
export class NavCounts {
  private readonly _counts = signal<Partial<Record<ConsoleArea, number>>>({});

  readonly counts = this._counts.asReadonly();

  set(area: ConsoleArea, count: number | null): void {
    this._counts.update((current) => {
      const next = { ...current };
      if (count === null || count <= 0) delete next[area];
      else next[area] = count;
      return next;
    });
  }
}

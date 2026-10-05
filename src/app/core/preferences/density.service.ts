import { Injectable, signal } from '@angular/core';

const KEY = 'dba.density';

@Injectable({ providedIn: 'root' })
export class DensityService {
  private readonly _compact = signal(this.read());
  readonly compact = this._compact.asReadonly();

  toggle(): void {
    this.set(!this._compact());
  }

  set(compact: boolean): void {
    this._compact.set(compact);
    try {
      localStorage.setItem(KEY, compact ? 'compact' : 'cozy');
    } catch {
      return;
    }
  }

  private read(): boolean {
    try {
      return localStorage.getItem(KEY) === 'compact';
    } catch {
      return false;
    }
  }
}

import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class OpenMenuService {
  private readonly open = signal<symbol | null>(null);
  readonly current = this.open.asReadonly();

  claim(menu: symbol): void {
    this.open.set(menu);
  }

  release(menu: symbol): void {
    if (this.open() === menu) this.open.set(null);
  }
}

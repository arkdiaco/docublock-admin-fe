import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HardNavigation {
  to(path: string): void {
    window.location.assign(path);
  }

  reload(): void {
    window.location.reload();
  }
}

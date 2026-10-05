import { DOCUMENT } from '@angular/common';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { buildIdOf } from './build-id';

export const CURRENT_BUILD = new InjectionToken<string | null>('CURRENT_BUILD', {
  providedIn: 'root',
  factory: () => buildIdOf(Array.from(inject(DOCUMENT).scripts, (script) => script.getAttribute('src') ?? '').join(' ')),
});

@Injectable({ providedIn: 'root' })
export class LatestBuild {
  async id(): Promise<string | null> {
    try {
      const response = await fetch('/index.html', { cache: 'no-store', credentials: 'same-origin' });
      return response.ok ? buildIdOf(await response.text()) : null;
    } catch {
      return null;
    }
  }
}

import { Injectable } from '@angular/core';
import type { StoredSession } from './auth.models';

const KEY = 'dba.session';

@Injectable({ providedIn: 'root' })
export class SessionStorage {
  read(): StoredSession | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredSession;
      return parsed.accessToken ? parsed : null;
    } catch {
      return null;
    }
  }

  write(session: StoredSession): void {
    localStorage.setItem(KEY, JSON.stringify(session));
  }

  clear(): void {
    localStorage.removeItem(KEY);
  }
}

import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { HardNavigation } from '../browser/hard-navigation';
import { isStaleChunkError } from './build-id';
import { CURRENT_BUILD, LatestBuild } from './latest-build';

export const CHECK_EVERY_MS = 5 * 60_000;
export const MIN_GAP_MS = 60_000;
export const RETRY_GUARD_MS = 30_000;
const RECOVERY_KEY = 'db.stale-chunk';

@Injectable({ providedIn: 'root' })
export class AppUpdate {
  private readonly current = inject(CURRENT_BUILD);
  private readonly latest = inject(LatestBuild);
  private readonly navigation = inject(HardNavigation);
  private readonly document = inject(DOCUMENT);
  private readonly worker = inject(SwUpdate, { optional: true });
  private readonly _available = signal(false);
  private lastCheck = 0;

  readonly available = this._available.asReadonly();

  start(): void {
    if (!this.current) return;
    const view = this.document.defaultView;
    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'visible') void this.check();
    });
    view?.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      if (isStaleChunkError(event.reason)) this._available.set(true);
    });
    view?.setInterval(() => void this.check(), CHECK_EVERY_MS);
    if (this.worker?.isEnabled) {
      this.worker.versionUpdates.subscribe((event) => {
        if (event.type === 'VERSION_READY') this._available.set(true);
      });
      this.worker.unrecoverable.subscribe(() => this._available.set(true));
    }
  }

  async check(): Promise<void> {
    if (!this.current || this._available() || Date.now() - this.lastCheck < MIN_GAP_MS) return;
    this.lastCheck = Date.now();
    if (this.worker?.isEnabled) {
      await this.checkWorker();
      return;
    }
    const latest = await this.latest.id();
    if (latest && latest !== this.current) this._available.set(true);
  }

  async apply(): Promise<void> {
    await this.activateWorker();
    this.navigation.reload();
  }

  recover(error: unknown, url: string): boolean {
    if (!isStaleChunkError(error) || this.recentlyRecovered(url)) return false;
    this.remember(url);
    this.navigation.to(url);
    return true;
  }

  private async checkWorker(): Promise<void> {
    try {
      if (await this.worker?.checkForUpdate()) this._available.set(true);
    } catch {
      return;
    }
  }

  private async activateWorker(): Promise<void> {
    if (!this.worker?.isEnabled) return;
    try {
      await this.worker.activateUpdate();
    } catch {
      return;
    }
  }

  private recentlyRecovered(url: string): boolean {
    try {
      const last = JSON.parse(sessionStorage.getItem(RECOVERY_KEY) ?? 'null') as { url: string; at: number } | null;
      return last?.url === url && Date.now() - last.at < RETRY_GUARD_MS;
    } catch {
      return false;
    }
  }

  private remember(url: string): void {
    try {
      sessionStorage.setItem(RECOVERY_KEY, JSON.stringify({ url, at: Date.now() }));
    } catch {
      return;
    }
  }
}

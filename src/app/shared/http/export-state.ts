import { signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import type { ExportedFile } from './exported-file';
import { saveBlob } from './save-blob';

export class ExportState {
  private readonly _busy = signal(false);
  readonly busy = this._busy.asReadonly();

  async run(source: Observable<ExportedFile>): Promise<boolean> {
    if (this._busy()) return false;
    this._busy.set(true);
    try {
      const file = await firstValueFrom(source);
      saveBlob(file.blob, file.filename);
      return true;
    } catch {
      return false;
    } finally {
      this._busy.set(false);
    }
  }
}

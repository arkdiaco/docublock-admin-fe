import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type {
  DialogRequest,
  DialogResult,
} from '../../shared/ui/dialog.component';

@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly translate = inject(TranslateService);
  private readonly pending = signal<DialogRequest | null>(null);
  private resolver: ((result: DialogResult) => void) | null = null;

  readonly request = computed(() => this.pending());

  open(request: DialogRequest): Promise<DialogResult> {
    this.pending.set(request);
    document.body.style.overflow = 'hidden';
    return new Promise<DialogResult>((resolve) => {
      this.resolver = resolve;
    });
  }

  close(result: DialogResult): void {
    this.pending.set(null);
    document.body.style.overflow = '';
    this.resolver?.(result);
    this.resolver = null;
  }

  async confirm(request: DialogRequest): Promise<boolean> {
    const result = await this.open(request);
    return result.answer === 'confirm';
  }

  confirmDelete(count: number): Promise<boolean> {
    return this.confirm({
      intent: 'danger',
      icon: 'trash',
      title: this.translate.instant('dialog.deleteTitle', { count }) as string,
      message: this.translate.instant('dialog.deleteMessage') as string,
      confirmLabel: this.translate.instant('dialog.deleteConfirm', { count }) as string,
    });
  }

  status(request: DialogRequest): Promise<DialogResult> {
    return this.open({ ...request, layout: 'status' });
  }
}

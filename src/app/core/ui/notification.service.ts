import { Injectable, Injector, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';

export type ToastKind = 'success' | 'error' | 'info';

const LIFE_MS = 5000;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly messages = inject(MessageService);
  private readonly injector = inject(Injector);

  success(message: string): void {
    this.push('success', message);
  }

  error(message: string): void {
    this.push('error', message);
  }

  info(message: string): void {
    this.push('info', message);
  }

  clear(): void {
    this.messages.clear();
  }

  private push(kind: ToastKind, message: string): void {
    this.messages.add({
      severity: kind,
      summary: this.injector.get(TranslateService).instant(`toast.${kind}`) as string,
      detail: message,
      life: LIFE_MS,
    });
  }
}

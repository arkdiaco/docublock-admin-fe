import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

export type ToastKind = 'success' | 'error' | 'info';

const LIFE_MS = 5000;

const TITLES: Record<ToastKind, string> = {
  success: 'Listo',
  error: 'Error',
  info: 'Aviso',
};

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly messages = inject(MessageService);

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
      summary: TITLES[kind],
      detail: message,
      life: LIFE_MS,
    });
  }
}

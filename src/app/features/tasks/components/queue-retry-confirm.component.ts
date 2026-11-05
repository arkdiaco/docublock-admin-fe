import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import type { QueueItem, QueueKey } from '../data/tasks.models';

@Component({
  selector: 'dba-queue-retry-confirm',
  imports: [TranslatePipe, FieldComponent, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="rotate"
      [title]="'task.retry.title' | translate"
      [subtitle]="'task.queue.' + queue() + '.name' | translate"
      confirmLabel="task.retry.confirm"
      [confirmDisabled]="!reason().trim()"
      [busy]="busy()"
      [maxWidth]="520"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <p class="notice" role="note">
          {{ 'task.retry.notice.' + queue() | translate: { date: created() } }}
        </p>
        <dba-field label="sub.reasonLabel" placeholder="sub.reasonPlaceholder" [maxlength]="500" [(value)]="reason" />
      </div>
    </db-modal-shell>
  `,
  styleUrls: ['../../../shared/ui/modal-form.scss', '../../../shared/ui/confirm-notice.scss'],
})
export class QueueRetryConfirmComponent {
  readonly queue = input.required<QueueKey>();
  readonly item = input.required<QueueItem>();
  readonly busy = input(false);
  readonly submitted = output<string>();
  readonly dismissed = output<void>();

  private readonly locale = inject(LOCALE_ID);

  protected readonly reason = signal('');
  protected readonly created = computed(() => {
    const value = this.item().createdAt;
    return value ? formatDate(value, 'd/MM/y', this.locale) : '—';
  });

  protected submit(): void {
    const reason = this.reason().trim();
    if (reason && !this.busy()) this.submitted.emit(reason);
  }
}

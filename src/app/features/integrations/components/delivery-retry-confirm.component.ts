import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import type { RetryPreview } from '../data/integrations.models';

@Component({
  selector: 'dba-delivery-retry-confirm',
  imports: [TranslatePipe, FieldComponent, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="rotate"
      [title]="'dlv.retry.title' | translate"
      confirmLabel="dlv.retry.confirm"
      [confirmDisabled]="!reason().trim()"
      [busy]="busy()"
      [maxWidth]="520"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <p class="notice" role="note">
          {{ 'dlv.retry.notice' | translate: { total: total(), failed: preview().failed, exhausted: preview().exhausted } }}
        </p>
        @if (preview().exhausted > 0) {
          <p class="notice" role="note">{{ 'dlv.retry.oneMore' | translate }}</p>
        }
        @if (oldest(); as date) {
          <p class="notice" role="note">{{ 'dlv.retry.oldest' | translate: { date: date } }}</p>
        }
        @if (total() > preview().limit) {
          <p class="notice" role="note">
            {{ 'dlv.retry.overLimit' | translate: { limit: preview().limit, rest: total() - preview().limit } }}
          </p>
        }
        <dba-field label="sub.reasonLabel" placeholder="sub.reasonPlaceholder" [maxlength]="500" [(value)]="reason" />
      </div>
    </db-modal-shell>
  `,
  styleUrls: ['../../../shared/ui/modal-form.scss', '../../../shared/ui/confirm-notice.scss'],
})
export class DeliveryRetryConfirmComponent {
  readonly preview = input.required<RetryPreview>();
  readonly busy = input(false);
  readonly submitted = output<string>();
  readonly dismissed = output<void>();

  private readonly locale = inject(LOCALE_ID);

  protected readonly reason = signal('');
  protected readonly total = computed(() => this.preview().failed + this.preview().exhausted);
  protected readonly oldest = computed(() => {
    const at = this.preview().oldestAt;
    return at ? formatDate(at, 'd/MM/y', this.locale) : null;
  });

  protected submit(): void {
    const reason = this.reason().trim();
    if (reason && !this.busy()) this.submitted.emit(reason);
  }
}

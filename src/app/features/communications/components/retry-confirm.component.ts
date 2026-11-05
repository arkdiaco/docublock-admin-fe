import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';

@Component({
  selector: 'dba-retry-confirm',
  imports: [TranslatePipe, FieldComponent, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="send"
      [title]="'comm.retry.title' | translate"
      [subtitle]="'comm.send.confirmSubtitle' | translate"
      confirmLabel="comm.retry.confirm"
      [confirmDisabled]="!reason().trim()"
      [busy]="busy()"
      [maxWidth]="520"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <p class="sum">
          @if (failed() === 1) {
            {{ 'comm.retry.summaryOne' | translate }}
          } @else {
            {{ 'comm.retry.summary' | translate: { total: failed() } }}
          }
          {{ 'comm.retry.others' | translate }}
        </p>
        @if (uncertain() === 1) {
          <p class="notice" role="note">{{ 'comm.retry.uncertainOne' | translate }}</p>
        } @else if (uncertain() > 1) {
          <p class="notice" role="note">{{ 'comm.retry.uncertain' | translate: { total: uncertain() } }}</p>
        }
        <p class="notice" role="note">{{ 'comm.send.notice' | translate }}</p>
        <dba-field label="sub.reasonLabel" placeholder="sub.reasonPlaceholder" [maxlength]="500" [(value)]="reason" />
      </div>
    </db-modal-shell>
  `,
  styleUrls: ['../../../shared/ui/modal-form.scss', './confirm-notice.scss'],
})
export class RetryConfirmComponent {
  readonly failed = input.required<number>();
  readonly uncertain = input(0);
  readonly busy = input(false);
  readonly submitted = output<string>();
  readonly dismissed = output<void>();

  protected readonly reason = signal('');
  private readonly canSend = computed(() => !!this.reason().trim() && !this.busy());

  protected submit(): void {
    if (this.canSend()) this.submitted.emit(this.reason().trim());
  }
}

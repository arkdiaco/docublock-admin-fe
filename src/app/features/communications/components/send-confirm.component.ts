import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';

@Component({
  selector: 'dba-send-confirm',
  imports: [TranslatePipe, FieldComponent, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="send"
      [title]="'comm.send.confirmTitle' | translate"
      [subtitle]="'comm.send.confirmSubtitle' | translate"
      confirmLabel="comm.send.confirm"
      [confirmDisabled]="!reason().trim()"
      [busy]="busy()"
      [maxWidth]="520"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <p class="sum">
          @if (sendable() === 1) {
            {{ 'comm.send.summaryOne' | translate }}
          } @else {
            {{ 'comm.send.summary' | translate: { total: sendable() } }}
          }
          @if (excluded() === 1) {
            {{ 'comm.send.leftOne' | translate }}
          } @else if (excluded() > 1) {
            {{ 'comm.send.left' | translate: { total: excluded() } }}
          }
        </p>
        <p class="notice" role="note">{{ 'comm.send.notice' | translate }}</p>
        <dba-field
          label="sub.reasonLabel"
          placeholder="sub.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrls: ['../../../shared/ui/modal-form.scss', '../../../shared/ui/confirm-notice.scss'],
})
export class SendConfirmComponent {
  readonly sendable = input.required<number>();
  readonly excluded = input(0);
  readonly busy = input(false);
  readonly submitted = output<string>();
  readonly dismissed = output<void>();

  protected readonly reason = signal('');
  protected readonly canSend = computed(() => !!this.reason().trim() && !this.busy());

  protected submit(): void {
    if (this.canSend()) this.submitted.emit(this.reason().trim());
  }
}

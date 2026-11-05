import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import type { DeliveryDetail } from '../data/integrations.models';

@Component({
  selector: 'dba-delivery-replay-confirm',
  imports: [TranslatePipe, FieldComponent, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="rotate"
      [title]="'dlv.replay.title' | translate"
      [subtitle]="delivery().organizationName || ''"
      confirmLabel="dlv.replay.confirm"
      [confirmDisabled]="!reason().trim()"
      [busy]="busy()"
      [maxWidth]="520"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <p class="notice" role="note">
          {{ 'dlv.replay.notice' | translate: { url: delivery().destinationUrl } }}
        </p>
        @if (delivery().status === 'delivered') {
          <p class="notice" role="note">{{ 'dlv.replay.alreadyDelivered' | translate }}</p>
        } @else if (delivery().status !== 'exhausted') {
          <p class="notice" role="note">{{ 'dlv.replay.stillRetrying' | translate }}</p>
        }
        <dba-field label="sub.reasonLabel" placeholder="sub.reasonPlaceholder" [maxlength]="500" [(value)]="reason" />
      </div>
    </db-modal-shell>
  `,
  styleUrls: ['../../../shared/ui/modal-form.scss', '../../../shared/ui/confirm-notice.scss'],
})
export class DeliveryReplayConfirmComponent {
  readonly delivery = input.required<DeliveryDetail>();
  readonly busy = input(false);
  readonly submitted = output<string>();
  readonly dismissed = output<void>();

  protected readonly reason = signal('');

  protected submit(): void {
    const reason = this.reason().trim();
    if (reason && !this.busy()) this.submitted.emit(reason);
  }
}

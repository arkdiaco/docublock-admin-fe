import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import type { KeyRow } from '../data/integrations.models';

@Component({
  selector: 'dba-key-revoke-confirm',
  imports: [TranslatePipe, FieldComponent, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="shield"
      [title]="'ikey.revoke.title' | translate"
      [subtitle]="key().organizationName || ''"
      confirmLabel="ikey.revoke.confirm"
      [confirmDisabled]="!reason().trim()"
      [busy]="busy()"
      [maxWidth]="520"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <p class="notice" role="note">{{ 'ikey.revoke.notice' | translate: { name: key().name, prefix: key().prefix } }}</p>
        <dba-field label="sub.reasonLabel" placeholder="sub.reasonPlaceholder" [maxlength]="500" [(value)]="reason" />
      </div>
    </db-modal-shell>
  `,
  styleUrls: ['../../../shared/ui/modal-form.scss', '../../../shared/ui/confirm-notice.scss'],
})
export class KeyRevokeConfirmComponent {
  readonly key = input.required<KeyRow>();
  readonly busy = input(false);
  readonly submitted = output<string>();
  readonly dismissed = output<void>();

  protected readonly reason = signal('');

  protected submit(): void {
    const reason = this.reason().trim();
    if (reason && !this.busy()) this.submitted.emit(reason);
  }
}

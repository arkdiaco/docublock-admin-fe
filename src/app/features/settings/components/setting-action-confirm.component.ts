import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';

@Component({
  selector: 'dba-setting-action-confirm',
  imports: [TranslatePipe, FieldComponent, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="settings"
      [title]="titleKey() | translate"
      [subtitle]="subtitle()"
      [confirmLabel]="confirmKey()"
      [confirmDisabled]="!reason().trim()"
      [busy]="busy()"
      [maxWidth]="520"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <p class="sum">{{ summary() }}</p>
        <dba-field
          label="cfg.reasonLabel"
          placeholder="cfg.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
        <p class="sum">{{ 'cfg.edit.delay' | translate }}</p>
      </div>
    </db-modal-shell>
  `,
  styleUrls: ['../../../shared/ui/modal-form.scss', '../../../shared/ui/confirm-notice.scss'],
})
export class SettingActionConfirmComponent {
  readonly titleKey = input.required<string>();
  readonly confirmKey = input.required<string>();
  readonly subtitle = input('');
  readonly summary = input.required<string>();
  readonly busy = input(false);
  readonly submitted = output<string>();
  readonly dismissed = output<void>();

  protected readonly reason = signal('');

  protected submit(): void {
    const reason = this.reason().trim();
    if (reason && !this.busy()) this.submitted.emit(reason);
  }
}

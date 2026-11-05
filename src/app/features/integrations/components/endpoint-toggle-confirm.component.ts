import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import type { EndpointRow } from '../data/integrations.models';

@Component({
  selector: 'dba-endpoint-toggle-confirm',
  imports: [TranslatePipe, FieldComponent, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="send"
      [title]="(endpoint().enabled ? 'iep.disable.title' : 'iep.enable.title') | translate"
      [subtitle]="endpoint().organizationName || ''"
      [confirmLabel]="endpoint().enabled ? 'iep.disable.confirm' : 'iep.enable.confirm'"
      [confirmDisabled]="!reason().trim()"
      [busy]="busy()"
      [maxWidth]="520"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <p class="notice" role="note">
          {{ (endpoint().enabled ? 'iep.disable.notice' : 'iep.enable.notice') | translate: { url: endpoint().url } }}
        </p>
        <dba-field label="sub.reasonLabel" placeholder="sub.reasonPlaceholder" [maxlength]="500" [(value)]="reason" />
      </div>
    </db-modal-shell>
  `,
  styleUrls: ['../../../shared/ui/modal-form.scss', '../../../shared/ui/confirm-notice.scss'],
})
export class EndpointToggleConfirmComponent {
  readonly endpoint = input.required<EndpointRow>();
  readonly busy = input(false);
  readonly submitted = output<string>();
  readonly dismissed = output<void>();

  protected readonly reason = signal('');

  protected submit(): void {
    const reason = this.reason().trim();
    if (reason && !this.busy()) this.submitted.emit(reason);
  }
}

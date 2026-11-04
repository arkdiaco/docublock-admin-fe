import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { OrgPickerComponent } from '../../../shared/ui/org-picker.component';

@Component({
  selector: 'dba-signer-organization-form',
  imports: [TranslatePipe, ModalShellComponent, FieldComponent, OrgPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="plus"
      [title]="'sig.organizations.addTitle' | translate"
      [subtitle]="signerName()"
      confirmLabel="sig.organizations.addConfirm"
      [confirmDisabled]="!canSave()"
      [busy]="busy()"
      [maxWidth]="480"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <div class="form__control">
          <span class="form__label">{{ 'sig.organizations.organization' | translate }}</span>
          <dba-org-picker
            anyKey="sig.organizations.pick"
            [value]="orgId()"
            (picked)="orgId.set($event)"
          />
          @if (already()) {
            <p class="form__note">{{ 'sig.organizations.already' | translate }}</p>
          }
        </div>
        <dba-field
          label="sub.reasonLabel"
          placeholder="sub.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../../../shared/ui/modal-form.scss',
})
export class SignerOrganizationFormComponent {
  readonly signerName = input.required<string>();
  readonly linked = input.required<readonly string[]>();
  readonly busy = input(false);
  readonly submitted = output<{ orgId: string; reason: string }>();
  readonly dismissed = output<void>();

  protected readonly orgId = signal<string | null>(null);
  protected readonly reason = signal('');
  protected readonly already = computed(() => {
    const orgId = this.orgId();
    return !!orgId && this.linked().includes(orgId);
  });
  protected readonly canSave = computed(
    () => !!this.orgId() && !this.already() && !!this.reason().trim(),
  );

  protected submit(): void {
    const orgId = this.orgId();
    if (this.canSave() && orgId) this.submitted.emit({ orgId, reason: this.reason().trim() });
  }
}

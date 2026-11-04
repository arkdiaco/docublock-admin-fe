import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { LegalEntitySignerPickerComponent } from './legal-entity-signer-picker.component';

@Component({
  selector: 'dba-legal-entity-representative-form',
  imports: [
    TranslatePipe,
    FormsModule,
    ToggleSwitch,
    FieldComponent,
    ModalShellComponent,
    LegalEntitySignerPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="plus"
      [title]="'jur.representatives.addTitle' | translate"
      [subtitle]="entityName()"
      confirmLabel="jur.representatives.addConfirm"
      [confirmDisabled]="!canSave()"
      [busy]="busy()"
      [maxWidth]="480"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <div class="form__control">
          <label class="form__label" for="representative-signer">{{
            'jur.representatives.signer' | translate
          }}</label>
          <dba-legal-entity-signer-picker
            inputId="representative-signer"
            [value]="signerId()"
            (picked)="signerId.set($event)"
          />
          @if (already()) {
            <p class="dba-meta">{{ 'jur.representatives.already' | translate }}</p>
          }
        </div>
        <div class="form__switch form__switch--bare">
          <p-toggleswitch
            inputId="representative-legal"
            [ngModel]="isLegalRep()"
            (ngModelChange)="isLegalRep.set($event)"
          />
          <label class="form__label" for="representative-legal">{{
            'jur.form.isLegalRep' | translate
          }}</label>
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
export class LegalEntityRepresentativeFormComponent {
  readonly entityName = input.required<string>();
  readonly linked = input.required<readonly string[]>();
  readonly busy = input(false);
  readonly submitted = output<{ signerId: string; isLegalRep: boolean; reason: string }>();
  readonly dismissed = output<void>();

  protected readonly signerId = signal<string | null>(null);
  protected readonly isLegalRep = signal(false);
  protected readonly reason = signal('');
  protected readonly already = computed(() => {
    const signerId = this.signerId();
    return !!signerId && this.linked().includes(signerId);
  });
  protected readonly canSave = computed(
    () => !!this.signerId() && !this.already() && !!this.reason().trim(),
  );

  protected submit(): void {
    const signerId = this.signerId();
    if (this.canSave() && signerId) {
      this.submitted.emit({
        signerId,
        isLegalRep: this.isLegalRep(),
        reason: this.reason().trim(),
      });
    }
  }
}

import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { FieldComponent } from '../../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../../shared/ui/modal-shell.component';
import type { QuotaRow, TransferQuotaBody } from '../../data/quotas.models';
import { wholeNumber } from '../../data/form-values';
import { transferable } from '../../data/quota-rows';

const GLOBAL = 'organization';

@Component({
  selector: 'dba-transfer-quota-form',
  imports: [TranslatePipe, FormsModule, ModalShellComponent, FieldComponent, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="send"
      [title]="'quota.transfer.title' | translate: { name: row().name }"
      [subtitle]="'quota.transfer.available' | translate: { count: movable() }"
      confirmLabel="quota.transfer.confirm"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="480"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <div class="form__control">
          <label class="form__label" for="quota-dest">{{
            'quota.transfer.dest' | translate
          }}</label>
          <p-select
            inputId="quota-dest"
            [options]="options()"
            optionLabel="label"
            optionValue="key"
            [filter]="true"
            [placeholder]="'common.pick' | translate"
            [ngModel]="dest()"
            (ngModelChange)="dest.set($event)"
            appendTo="body"
            styleClass="form__select"
          />
        </div>
        <dba-field
          label="quota.transfer.amount"
          inputmode="numeric"
          [error]="error()"
          [(value)]="amount"
        />
        <dba-field
          label="sub.reasonLabel"
          placeholder="sub.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../modal-form.scss',
})
export class TransferQuotaFormComponent {
  readonly row = input.required<QuotaRow>();
  readonly rows = input.required<readonly QuotaRow[]>();
  readonly globalLabel = input.required<string>();
  readonly typeLabel = input.required<(row: QuotaRow) => string>();
  readonly busy = input(false);
  readonly submitted = output<TransferQuotaBody>();
  readonly dismissed = output<void>();

  protected readonly dest = signal<string | null>(null);
  protected readonly amount = signal('');
  protected readonly reason = signal('');

  protected readonly options = computed(() => [
    { key: GLOBAL, label: this.globalLabel() },
    ...this.rows()
      .filter((r) => r.id !== this.row().id && r.categoryType === this.row().categoryType)
      .map((r) => ({
        key: `${r.categoryType}:${r.id}`,
        label: `${this.typeLabel()(r)} · ${r.name}`,
      })),
  ]);

  protected readonly value = computed(() => wholeNumber(this.amount()));
  protected readonly movable = computed(() => transferable(this.row()));

  protected readonly error = computed(() => {
    if (!this.amount().trim()) return '';
    const value = this.value();
    if (value === null || value < 1) return 'sub.error.wholeNumber';
    return value > this.movable() ? 'quota.error.aboveAvailable' : '';
  });

  protected readonly valid = computed(
    () => !!this.dest() && this.value() !== null && !this.error() && !!this.reason().trim(),
  );

  protected submit(): void {
    const dest = this.dest();
    const amount = this.value();
    if (!this.valid() || !dest || amount === null) return;
    const row = this.row();
    const [destType, destId] = dest === GLOBAL ? [GLOBAL, undefined] : dest.split(':');
    this.submitted.emit({
      sourceCategoryType: row.categoryType,
      sourceCategoryId: row.id,
      destCategoryType: destType as TransferQuotaBody['destCategoryType'],
      ...(destId && { destCategoryId: destId }),
      amount,
      reason: this.reason().trim(),
    });
  }
}

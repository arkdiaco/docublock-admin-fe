import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FieldComponent } from '../../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../../shared/ui/modal-shell.component';
import type { AssignQuotaBody, QuotaRow } from '../../data/quotas.models';
import { wholeNumber } from '../../data/form-values';

@Component({
  selector: 'dba-assign-quota-form',
  imports: [TranslatePipe, ModalShellComponent, FieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="blocks"
      [title]="'quota.assign.title' | translate: { name: row().name }"
      [subtitle]="
        'quota.assign.now'
          | translate: { assigned: row().quotaAssigned, consumed: row().quotaConsumed }
      "
      confirmLabel="quota.assign.confirm"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="440"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <dba-field
          label="quota.assign.quota"
          inputmode="numeric"
          [hint]="boundsText()"
          [error]="error()"
          [(value)]="quota"
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
export class AssignQuotaFormComponent implements OnInit {
  readonly row = input.required<QuotaRow>();
  readonly boundsText = input('');
  readonly busy = input(false);
  readonly submitted = output<AssignQuotaBody>();
  readonly dismissed = output<void>();

  protected readonly quota = signal('');
  protected readonly reason = signal('');

  protected readonly value = computed(() => wholeNumber(this.quota()));

  protected readonly error = computed(() => {
    const value = this.value();
    if (!this.quota().trim()) return '';
    if (value === null) return 'sub.error.wholeNumber';
    const { minQuota, maxQuota } = this.row();
    if (value < minQuota) return 'quota.error.belowMin';
    if (maxQuota !== null && value > maxQuota) return 'quota.error.aboveMax';
    return '';
  });

  protected readonly valid = computed(
    () =>
      this.value() !== null &&
      !this.error() &&
      this.value() !== this.row().quotaAssigned &&
      !!this.reason().trim(),
  );

  ngOnInit(): void {
    this.quota.set(String(this.row().quotaAssigned));
  }

  protected submit(): void {
    const row = this.row();
    const quota = this.value();
    if (!this.valid() || quota === null) return;
    this.submitted.emit({
      categoryType: row.categoryType,
      categoryId: row.id,
      quota,
      reason: this.reason().trim(),
    });
  }
}

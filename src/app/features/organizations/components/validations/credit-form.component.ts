import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { FieldComponent } from '../../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../../shared/ui/modal-shell.component';
import { wholeNumber } from '../../data/form-values';
import type { CreditBalance, CreditChange, CreditType } from '../../data/validations.models';

type Mode = 'recharge' | 'set';

@Component({
  selector: 'dba-credit-form',
  imports: [TranslatePipe, FormsModule, ModalShellComponent, FieldComponent, Select, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="idCard"
      [title]="'val.credit.title' | translate: { type: ('val.creditType.' + type() | translate) }"
      [subtitle]="
        balance().unlimited
          ? ('val.unlimited' | translate)
          : ('val.credit.now' | translate: { count: balance().remaining })
      "
      confirmLabel="val.credit.confirm"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="460"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <div class="form__switch form__switch--bare">
          <p-toggleswitch
            inputId="credit-unlimited"
            [ngModel]="unlimited()"
            (ngModelChange)="unlimited.set($event)"
          />
          <label class="form__label" for="credit-unlimited">{{
            'val.credit.unlimited' | translate
          }}</label>
        </div>
        @if (!unlimited()) {
          <div class="form__pair">
            <div class="form__control">
              <label class="form__label" for="credit-mode">{{
                'val.credit.mode' | translate
              }}</label>
              <p-select
                inputId="credit-mode"
                [options]="modes()"
                optionLabel="label"
                optionValue="value"
                [ngModel]="mode()"
                (ngModelChange)="mode.set($event)"
                appendTo="body"
                styleClass="form__select"
              />
            </div>
            <dba-field
              [label]="mode() === 'recharge' ? 'val.credit.amount' : 'val.credit.remaining'"
              inputmode="numeric"
              [error]="amountError()"
              [(value)]="amount"
            />
          </div>
        }
        <dba-field
          label="sub.reasonLabel"
          placeholder="sub.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../../../../shared/ui/modal-form.scss',
})
export class CreditFormComponent implements OnInit {
  readonly type = input.required<CreditType>();
  readonly balance = input.required<CreditBalance>();
  readonly modeLabels = input.required<{ recharge: string; set: string }>();
  readonly busy = input(false);
  readonly submitted = output<{ change: CreditChange; reason: string }>();
  readonly dismissed = output<void>();

  protected readonly unlimited = signal(false);
  protected readonly mode = signal<Mode>('recharge');
  protected readonly amount = signal('');
  protected readonly reason = signal('');

  protected readonly modes = computed(() => [
    { value: 'recharge', label: this.modeLabels().recharge },
    { value: 'set', label: this.modeLabels().set },
  ]);

  protected readonly value = computed(() => wholeNumber(this.amount()));

  protected readonly amountError = computed(() => {
    if (!this.amount().trim()) return '';
    const value = this.value();
    if (value === null) return 'sub.error.wholeNumber';
    return this.mode() === 'recharge' && value < 1 ? 'sub.error.wholeNumber' : '';
  });

  protected readonly change = computed<CreditChange | null>(() => {
    const balance = this.balance();
    if (this.unlimited()) return balance.unlimited ? null : { unlimited: true };
    const value = this.value();
    if (value === null || this.amountError())
      return balance.unlimited ? { unlimited: false } : null;
    const base: CreditChange = balance.unlimited ? { unlimited: false } : {};
    return this.mode() === 'recharge'
      ? { ...base, recharge: value }
      : { ...base, remaining: value };
  });

  protected readonly valid = computed(() => this.change() !== null && !!this.reason().trim());

  ngOnInit(): void {
    this.unlimited.set(this.balance().unlimited);
  }

  protected submit(): void {
    const change = this.change();
    if (this.valid() && change) this.submitted.emit({ change, reason: this.reason().trim() });
  }
}

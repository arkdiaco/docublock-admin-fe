import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { FieldComponent } from '../../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../../shared/ui/modal-shell.component';
import { wholeNumber } from '../../data/form-values';
import type {
  FilingBalance,
  FilingCreditChange,
  FilingCreditsBody,
} from '../../data/org-filing.models';

type Mode = 'recharge' | 'set';

@Component({
  selector: 'dba-filing-credits-form',
  imports: [TranslatePipe, FormsModule, ModalShellComponent, FieldComponent, Select, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="docCheck"
      [title]="'orgFiling.credits.title' | translate"
      [subtitle]="
        balance().unlimited
          ? ('orgFiling.unlimited' | translate)
          : ('orgFiling.credits.now' | translate: { count: balance().remaining })
      "
      confirmLabel="orgFiling.credits.confirm"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="460"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <div class="form__switch form__switch--bare">
          <p-toggleswitch
            inputId="filing-unlimited"
            [ngModel]="unlimited()"
            (ngModelChange)="unlimited.set($event)"
          />
          <label class="form__label" for="filing-unlimited">{{
            'orgFiling.credits.unlimited' | translate
          }}</label>
        </div>
        @if (!unlimited()) {
          <div class="form__pair">
            <div class="form__control">
              <label class="form__label" for="filing-mode">{{
                'orgFiling.credits.mode' | translate
              }}</label>
              <p-select
                inputId="filing-mode"
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
              [label]="
                mode() === 'recharge' ? 'orgFiling.credits.amount' : 'orgFiling.credits.remaining'
              "
              inputmode="numeric"
              [error]="amountError()"
              [(value)]="amount"
            />
          </div>
        }
        <dba-field
          label="orgFiling.credits.reason"
          placeholder="orgFiling.credits.reasonPlaceholder"
          [maxlength]="500"
          [(value)]="reason"
        />
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../../../../shared/ui/modal-form.scss',
})
export class FilingCreditsFormComponent implements OnInit {
  private readonly translate = inject(TranslateService);

  readonly balance = input.required<FilingBalance>();
  readonly busy = input(false);
  readonly submitted = output<FilingCreditsBody>();
  readonly dismissed = output<void>();

  protected readonly unlimited = signal(false);
  protected readonly mode = signal<Mode>('recharge');
  protected readonly amount = signal('');
  protected readonly reason = signal('');

  protected readonly modes = computed(() =>
    (['recharge', 'set'] as const).map((value) => ({
      value,
      label: this.translate.instant(`orgFiling.credits.modes.${value}`) as string,
    })),
  );

  protected readonly value = computed(() => wholeNumber(this.amount()));

  protected readonly amountError = computed(() => {
    if (!this.amount().trim()) return '';
    const value = this.value();
    if (value === null) return 'orgFiling.credits.wholeNumber';
    return this.mode() === 'recharge' && value < 1 ? 'orgFiling.credits.wholeNumber' : '';
  });

  protected readonly change = computed<FilingCreditChange | null>(() => {
    const balance = this.balance();
    if (this.unlimited()) return balance.unlimited ? null : { unlimited: true };
    const value = this.value();
    if (value === null || this.amountError())
      return balance.unlimited ? { unlimited: false } : null;
    const base: FilingCreditChange = balance.unlimited ? { unlimited: false } : {};
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
    if (this.valid() && change) this.submitted.emit({ ...change, reason: this.reason().trim() });
  }
}

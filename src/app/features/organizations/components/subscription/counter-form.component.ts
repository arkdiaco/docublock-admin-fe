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
import { ToggleSwitch } from 'primeng/toggleswitch';
import { FieldComponent } from '../../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../../shared/ui/modal-shell.component';
import type { CounterBody, SubscriptionCounter } from '../../data/subscription.models';
import { wholeNumber } from '../../data/form-values';

@Component({
  selector: 'dba-counter-form',
  imports: [TranslatePipe, FormsModule, ModalShellComponent, FieldComponent, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="pencil"
      [title]="'sub.counter.title' | translate: { resource: (resourceKey() | translate) }"
      [subtitle]="'sub.counter.now' | translate: { used: counter().used, limit: limitText() }"
      confirmLabel="sub.counter.confirm"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="460"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <div class="form__switch form__switch--top">
          <p-toggleswitch
            inputId="sub-unlimited"
            [ngModel]="unlimited()"
            (ngModelChange)="unlimited.set($event)"
          />
          <label class="form__label" for="sub-unlimited">{{
            'sub.counter.unlimited' | translate
          }}</label>
        </div>
        <div class="form__pair">
          <dba-field
            label="sub.counter.limit"
            inputmode="numeric"
            [disabled]="unlimited()"
            [error]="limitError()"
            [(value)]="limit"
          />
          <dba-field
            label="sub.counter.used"
            inputmode="numeric"
            [error]="usedError()"
            [(value)]="used"
          />
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
  styleUrl: '../../../../shared/ui/modal-form.scss',
  styles: `
    .form__switch--top {
      align-items: center;
      padding-top: 0;
      border-top: 0;
    }
  `,
})
export class CounterFormComponent implements OnInit {
  readonly counter = input.required<SubscriptionCounter>();
  readonly unlimitedLabel = input.required<string>();
  readonly busy = input(false);
  readonly submitted = output<CounterBody>();
  readonly dismissed = output<void>();

  protected readonly unlimited = signal(false);
  protected readonly limit = signal('');
  protected readonly used = signal('');
  protected readonly reason = signal('');

  protected readonly resourceKey = computed(() => `sub.resource.${this.counter().resource}`);
  protected readonly limitText = computed(() => this.counter().limit ?? this.unlimitedLabel());

  protected readonly limitError = computed(() =>
    !this.unlimited() && wholeNumber(this.limit()) === null ? 'sub.error.wholeNumber' : '',
  );
  protected readonly usedError = computed(() =>
    wholeNumber(this.used()) === null ? 'sub.error.wholeNumber' : '',
  );

  protected readonly patch = computed<Omit<CounterBody, 'reason'>>(() => {
    const counter = this.counter();
    const limit = this.unlimited() ? null : wholeNumber(this.limit());
    const used = wholeNumber(this.used());
    return {
      ...(limit !== counter.limit && (this.unlimited() || limit !== null) && { limit }),
      ...(used !== null && used !== counter.used && { used }),
    };
  });

  protected readonly valid = computed(
    () =>
      !this.limitError() &&
      !this.usedError() &&
      !!this.reason().trim() &&
      Object.keys(this.patch()).length > 0,
  );

  ngOnInit(): void {
    const counter = this.counter();
    this.unlimited.set(counter.limit === null);
    this.limit.set(counter.limit === null ? '' : String(counter.limit));
    this.used.set(String(counter.used));
  }

  protected submit(): void {
    if (this.valid()) this.submitted.emit({ ...this.patch(), reason: this.reason().trim() });
  }
}

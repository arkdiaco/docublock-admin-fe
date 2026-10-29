import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { FieldComponent } from '../../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../../shared/ui/modal-shell.component';
import type { AssignPlanBody, CatalogPlan } from '../../data/subscription.models';
import { endOfDay, isFutureDay, wholeNumber } from './subscription-dates';

type Validity = 'plan' | 'date' | 'none';

@Component({
  selector: 'dba-assign-plan-form',
  imports: [TranslatePipe, FormsModule, ModalShellComponent, FieldComponent, Select, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="documents"
      [title]="'sub.assign.title' | translate"
      [subtitle]="orgName()"
      confirmLabel="sub.assign.confirm"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="560"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <div class="form__control">
          <label class="form__label" for="sub-plan">{{ 'sub.assign.plan' | translate }}</label>
          <p-select
            inputId="sub-plan"
            [options]="planOptions()"
            optionLabel="label"
            optionValue="code"
            [filter]="true"
            [placeholder]="'common.pick' | translate"
            [ngModel]="planCode()"
            (ngModelChange)="planCode.set($event)"
            appendTo="body"
            styleClass="form__select"
          />
        </div>

        <div class="form__pair">
          <div class="form__control">
            <label class="form__label" for="sub-validity">{{
              'sub.assign.validity' | translate
            }}</label>
            <p-select
              inputId="sub-validity"
              [options]="validityOptions()"
              optionLabel="label"
              optionValue="value"
              [ngModel]="validity()"
              (ngModelChange)="validity.set($event)"
              appendTo="body"
              styleClass="form__select"
            />
          </div>
          @if (validity() === 'date') {
            <dba-field
              label="sub.assign.until"
              type="date"
              [error]="dateError()"
              [(value)]="until"
            />
          }
        </div>

        <dba-field
          label="sub.assign.documents"
          inputmode="numeric"
          [hint]="documentsHint()"
          [error]="documentsError()"
          [(value)]="documents"
        />

        <div class="form__switch">
          <p-toggleswitch
            inputId="sub-carry"
            [ngModel]="carry()"
            (ngModelChange)="carry.set($event)"
          />
          <span class="form__switchCopy">
            <label class="form__label" for="sub-carry">{{
              'sub.assign.carry' | translate: { count: carryable() }
            }}</label>
            <span class="dba-meta">{{
              (carry() ? 'sub.assign.carryOn' : 'sub.assign.carryOff') | translate
            }}</span>
          </span>
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
  styleUrl: './subscription-form.scss',
})
export class AssignPlanFormComponent {
  readonly plans = input.required<readonly CatalogPlan[]>();
  readonly orgName = input.required<string>();
  readonly carryable = input(0);
  readonly busy = input(false);
  readonly labels = input.required<{
    planValidity: (months: number | null) => string;
    until: string;
    none: string;
  }>();
  readonly submitted = output<AssignPlanBody>();
  readonly dismissed = output<void>();

  protected readonly planCode = signal<string | null>(null);
  protected readonly validity = signal<Validity>('plan');
  protected readonly until = signal('');
  protected readonly documents = signal('');
  protected readonly carry = signal(true);
  protected readonly reason = signal('');

  protected readonly plan = computed(
    () => this.plans().find((p) => p.code === this.planCode()) ?? null,
  );

  protected readonly planOptions = computed(() =>
    this.plans().map((p) => ({ code: p.code, label: `${p.name} · ${p.code}` })),
  );

  protected readonly validityOptions = computed(() => [
    { value: 'plan', label: this.labels().planValidity(this.plan()?.validityMonths ?? null) },
    { value: 'date', label: this.labels().until },
    { value: 'none', label: this.labels().none },
  ]);

  protected readonly documentsHint = computed(() => {
    const limit = this.plan()?.limits.documents;
    return limit === undefined
      ? ''
      : limit === null
        ? 'sub.assign.planUnlimited'
        : 'sub.assign.planDocuments';
  });

  protected readonly dateError = computed(() =>
    this.until().trim() && !isFutureDay(this.until()) ? 'sub.error.futureDate' : '',
  );

  protected readonly documentsError = computed(() =>
    this.documents().trim() && wholeNumber(this.documents()) === null
      ? 'sub.error.wholeNumber'
      : '',
  );

  protected readonly valid = computed(
    () =>
      !!this.plan() &&
      !!this.reason().trim() &&
      !this.documentsError() &&
      (this.validity() !== 'date' || isFutureDay(this.until())),
  );

  protected submit(): void {
    const plan = this.plan();
    if (!this.valid() || !plan) return;
    const documents = wholeNumber(this.documents());
    this.submitted.emit({
      planCode: plan.code,
      carry: this.carry(),
      reason: this.reason().trim(),
      ...(this.validity() === 'date' && { periodEnd: endOfDay(this.until()) }),
      ...(this.validity() === 'none' && { noExpiry: true }),
      ...(documents !== null && { documents }),
    });
  }
}

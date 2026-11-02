import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
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
import { firstValueFrom } from 'rxjs';
import { moneyExact } from '../../../shared/domain/money';
import { FieldComponent } from '../../../shared/ui/field.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { OrgPickerComponent } from '../../../shared/ui/org-picker.component';
import { BillingApi } from '../data/billing.api';
import {
  MANUAL_INTERVALS,
  type ManualInterval,
  type ManualPaymentBody,
  type ManualPlanOption,
} from '../data/billing.models';
import { REFERENCE_PATTERN, catalogPriceOf, numberOf } from '../data/billing-view';
import { TaxLinesComponent, taxDraftValid, type TaxDraft } from './tax-lines.component';

const CURRENCY = /^[A-Za-z]{3}$/;

@Component({
  selector: 'dba-manual-payment-form',
  imports: [
    TranslatePipe,
    FormsModule,
    Select,
    FieldComponent,
    ModalShellComponent,
    OrgPickerComponent,
    TaxLinesComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="plus"
      [title]="'billing.manual.title' | translate"
      [subtitle]="'billing.manual.subtitle' | translate"
      confirmLabel="billing.manual.confirm"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="620"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        <div class="form__control">
          <span class="form__label">{{ 'billing.manual.org' | translate }}</span>
          <dba-org-picker scope="commercial" anyKey="orgPicker.choose" [value]="organization()" (picked)="organization.set($event)" />
        </div>

        <div class="form__pair">
          <div class="form__control">
            <label class="form__label" for="manual-plan">{{
              'billing.manual.plan' | translate
            }}</label>
            <p-select
              inputId="manual-plan"
              [options]="planOptions()"
              optionLabel="label"
              optionValue="id"
              [ngModel]="planCode()"
              (ngModelChange)="planCode.set($event)"
              [placeholder]="
                (plansLoading() ? 'billing.manual.planLoading' : 'billing.manual.plan') | translate
              "
              [filter]="planOptions().length > 8"
              appendTo="body"
              styleClass="form__select"
            />
            @if (plansError()) {
              <span class="dba-meta">{{ 'billing.manual.planError' | translate }}</span>
            }
          </div>
          <div class="form__control">
            <label class="form__label" for="manual-interval">{{
              'billing.manual.interval' | translate
            }}</label>
            <p-select
              inputId="manual-interval"
              [options]="intervalOptions()"
              optionLabel="label"
              optionValue="id"
              [ngModel]="interval()"
              (ngModelChange)="interval.set($event)"
              appendTo="body"
              styleClass="form__select"
            />
          </div>
        </div>

        <div class="form__pair">
          <dba-field
            label="billing.manual.amount"
            inputmode="decimal"
            [placeholder]="catalogText()"
            [error]="amountError()"
            [hint]="catalogPrice() !== null ? 'billing.manual.amountHint' : ''"
            [(value)]="amount"
          />
          <dba-field
            label="billing.manual.currency"
            [placeholder]="plan()?.currency ?? ''"
            [maxlength]="3"
            [error]="currencyError()"
            [(value)]="currency"
          />
        </div>

        <div class="form__pair">
          <dba-field
            label="billing.manual.documents"
            inputmode="numeric"
            [placeholder]="planDocuments()"
            hint="billing.manual.documentsHint"
            [error]="documentsError()"
            [(value)]="documents"
          />
          <dba-field
            label="billing.manual.method"
            placeholder="billing.manual.methodPlaceholder"
            [maxlength]="40"
            [(value)]="method"
          />
        </div>

        <dba-field
          label="billing.manual.reference"
          hint="billing.manual.referenceHint"
          [maxlength]="80"
          [error]="referenceError()"
          [(value)]="reference"
        />

        <h3 class="dba-panel form__section">{{ 'billing.manual.taxes' | translate }}</h3>
        <p class="dba-body form__note--top">{{ 'billing.manual.taxesHint' | translate }}</p>
        <dba-tax-lines [lines]="taxes()" (linesChange)="taxes.set($event)" />

        <div class="form__summary" role="note">
          <strong>{{ 'billing.manual.warningTitle' | translate }}</strong>
          <span>{{ 'billing.manual.warningPeriod' | translate }}</span>
          <span>{{ 'billing.manual.warningInvoice' | translate }}</span>
          <span>{{ 'billing.manual.warningMail' | translate }}</span>
        </div>
      </div>
    </db-modal-shell>
  `,
  styleUrl: '../../../shared/ui/modal-form.scss',
})
export class ManualPaymentFormComponent implements OnInit {
  private readonly api = inject(BillingApi);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);

  readonly organizationId = input<string | null>(null);
  readonly busy = input(false);
  readonly submitted = output<ManualPaymentBody>();
  readonly dismissed = output<void>();

  protected readonly plansLoading = signal(true);
  protected readonly plansError = signal(false);
  private readonly plans = signal<ManualPlanOption[]>([]);

  protected readonly organization = signal<string | null>(null);
  protected readonly planCode = signal<string | null>(null);
  protected readonly interval = signal<ManualInterval>('monthly');
  protected readonly amount = signal('');
  protected readonly currency = signal('');
  protected readonly documents = signal('');
  protected readonly method = signal('');
  protected readonly reference = signal('');
  protected readonly taxes = signal<TaxDraft[]>([]);

  protected readonly planOptions = computed(() =>
    this.plans().map((plan) => ({ id: plan.code, label: plan.name })),
  );
  protected readonly intervalOptions = computed(() =>
    MANUAL_INTERVALS.map((id) => ({
      id,
      label: this.translate.instant(`billing.interval.${id}`) as string,
    })),
  );
  protected readonly plan = computed(
    () => this.plans().find((plan) => plan.code === this.planCode()) ?? null,
  );
  protected readonly catalogPrice = computed(() => {
    const plan = this.plan();
    return plan ? catalogPriceOf(plan, this.interval()) : null;
  });
  protected readonly catalogText = computed(() => {
    const price = this.catalogPrice();
    const plan = this.plan();
    return price !== null && plan ? moneyExact(price, plan.currency, this.locale) : '';
  });
  protected readonly planDocuments = computed(() => {
    const limit = this.plan()?.limits.documents;
    return limit === null || limit === undefined ? '' : String(limit);
  });

  protected readonly amountError = computed(() => {
    const text = this.amount().trim();
    if (!text)
      return this.plan() && this.catalogPrice() === null ? 'billing.manual.amountRequired' : '';
    const value = numberOf(text);
    return Number.isFinite(value) && value >= 0 ? '' : 'billing.manual.amountInvalid';
  });
  protected readonly currencyError = computed(() => {
    const text = this.currency().trim();
    return text && !CURRENCY.test(text) ? 'billing.manual.currencyInvalid' : '';
  });
  protected readonly documentsError = computed(() => {
    const text = this.documents().trim();
    if (!text) return '';
    const value = Number(text);
    return Number.isInteger(value) && value >= 1 ? '' : 'billing.manual.documentsInvalid';
  });
  protected readonly referenceError = computed(() => {
    const text = this.reference().trim();
    return text && !REFERENCE_PATTERN.test(text) ? 'billing.manual.referenceInvalid' : '';
  });

  protected readonly valid = computed(
    () =>
      !!this.organization() &&
      !!this.plan() &&
      !this.amountError() &&
      !this.currencyError() &&
      !this.documentsError() &&
      !this.referenceError() &&
      this.taxes().every(taxDraftValid) &&
      !this.busy(),
  );

  ngOnInit(): void {
    this.organization.set(this.organizationId());
    void this.loadPlans();
  }

  protected submit(): void {
    const organizationId = this.organization();
    const plan = this.plan();
    if (!this.valid() || !organizationId || !plan) return;
    const amount = this.amount().trim();
    const documents = this.documents().trim();
    this.submitted.emit({
      organizationId,
      planCode: plan.code,
      interval: this.interval(),
      amount: amount ? numberOf(amount) : undefined,
      currency: this.currency().trim().toUpperCase() || undefined,
      documents: documents ? Number(documents) : undefined,
      paymentMethod: this.method().trim() || undefined,
      reference: this.reference().trim() || undefined,
      taxes: this.taxes().length
        ? this.taxes().map((tax) => ({ type: tax.type.trim(), amount: numberOf(tax.amount) }))
        : undefined,
    });
  }

  private async loadPlans(): Promise<void> {
    try {
      this.plans.set(await firstValueFrom(this.api.plans()));
    } catch {
      this.plansError.set(true);
    } finally {
      this.plansLoading.set(false);
    }
  }
}

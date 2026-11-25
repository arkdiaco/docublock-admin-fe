import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { ButtonComponent } from '../../../../shared/ui/button.component';
import { FieldComponent } from '../../../../shared/ui/field.component';
import { IconComponent } from '../../../../shared/ui/icon.component';
import { ModalShellComponent } from '../../../../shared/ui/modal-shell.component';
import { moneyAmount, wholeNumber } from '../../data/form-values';
import type { CatalogPlan, PaygLink, PaygLinkBody } from '../../data/subscription.models';

export const PAYG_FAMILY = 'PAYG';

@Component({
  selector: 'dba-payg-link-form',
  imports: [TranslatePipe, FormsModule, ModalShellComponent, FieldComponent, Select, ButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (result(); as link) {
      <db-modal-shell
        icon="chain"
        [title]="'sub.payg.readyTitle' | translate"
        [subtitle]="orgName()"
        confirmLabel="sub.payg.done"
        [cancelable]="false"
        [maxWidth]="560"
        (confirmed)="dismissed.emit()"
        (dismissed)="dismissed.emit()"
      >
        <div class="form">
          <p class="dba-body form__note--top">
            {{ 'sub.payg.readyLead' | translate: { documents: link.documents, total: money(link.amount, link.currency) } }}
          </p>
          <code class="pg__link">{{ link.url }}</code>
          <div class="pg__actions">
            <span class="dba-meta">{{ 'sub.payg.reference' | translate: { reference: link.reference } }}</span>
            <button dba-button variant="secondary" (click)="copy(link.url)">
              <db-icon [name]="copied() ? 'check' : 'copy'" [size]="15" />
              {{ (copied() ? 'sub.payg.copied' : 'sub.payg.copy') | translate }}
            </button>
          </div>
        </div>
      </db-modal-shell>
    } @else {
      <db-modal-shell
        icon="chain"
        [title]="'sub.payg.title' | translate"
        [subtitle]="orgName()"
        confirmLabel="sub.payg.confirm"
        [confirmDisabled]="!valid()"
        [busy]="busy()"
        [maxWidth]="560"
        (confirmed)="submit()"
        (dismissed)="dismissed.emit()"
      >
        <div class="form">
          <div class="form__control">
            <label class="form__label" for="payg-plan">{{ 'sub.payg.plan' | translate }}</label>
            <p-select
              inputId="payg-plan"
              [options]="planOptions()"
              optionLabel="label"
              optionValue="code"
              [placeholder]="'common.pick' | translate"
              [ngModel]="planCode()"
              (ngModelChange)="planCode.set($event)"
              appendTo="body"
              styleClass="form__select"
            />
          </div>

          <div class="form__pair">
            <dba-field
              label="sub.payg.documents"
              inputmode="numeric"
              [error]="documentsError()"
              [(value)]="documents"
            />
            <dba-field
              label="sub.payg.unitPrice"
              inputmode="decimal"
              [hint]="currencyHint()"
              [error]="priceError()"
              [(value)]="unitPrice"
            />
          </div>

          <div class="form__summary">
            <span class="pg__total">
              {{ 'sub.payg.total' | translate }}
              <strong class="dba-mono">{{ totalText() }}</strong>
            </span>
            @if (plan(); as chosen) {
              <span class="dba-meta">{{
                (chosen.validityMonths ? 'sub.payg.validity' : 'sub.payg.validityDefault')
                  | translate: { months: chosen.validityMonths }
              }}</span>
            }
            <span class="dba-meta">{{ 'sub.payg.replaces' | translate }}</span>
          </div>
        </div>
      </db-modal-shell>
    }
  `,
  styleUrl: '../../../../shared/ui/modal-form.scss',
  styles: `
    .pg__link {
      display: block;
      padding: 12px 14px;
      border: 1px solid var(--dba-border-control);
      border-radius: var(--dba-radius-control);
      background: var(--dba-surface-muted);
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-small);
      color: var(--dba-ink);
      overflow-wrap: anywhere;
      user-select: all;
    }

    .pg__actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .pg__total {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
    }
  `,
})
export class PaygLinkFormComponent {
  readonly plans = input.required<readonly CatalogPlan[]>();
  readonly orgName = input.required<string>();
  readonly busy = input(false);
  readonly result = input<PaygLink | null>(null);
  readonly submitted = output<PaygLinkBody>();
  readonly dismissed = output<void>();

  private readonly locale = inject(LOCALE_ID);

  protected readonly planCode = signal<string | null>(null);
  protected readonly documents = signal('');
  protected readonly unitPrice = signal('');
  protected readonly copied = signal(false);

  protected readonly paygPlans = computed(() => this.plans().filter((p) => p.family === PAYG_FAMILY));

  protected readonly planOptions = computed(() =>
    this.paygPlans().map((p) => ({ code: p.code, label: `${p.name} · ${p.code}` })),
  );

  protected readonly plan = computed(() => this.paygPlans().find((p) => p.code === this.planCode()) ?? null);

  protected readonly documentsValue = computed(() => {
    const value = wholeNumber(this.documents());
    return value !== null && value > 0 ? value : null;
  });

  protected readonly priceValue = computed(() => {
    const value = moneyAmount(this.unitPrice());
    return value !== null && value > 0 ? value : null;
  });

  protected readonly documentsError = computed(() =>
    this.documents().trim() && this.documentsValue() === null ? 'sub.payg.error.documents' : '',
  );

  protected readonly priceError = computed(() =>
    this.unitPrice().trim() && this.priceValue() === null ? 'sub.payg.error.unitPrice' : '',
  );

  protected readonly currencyHint = computed(() => this.plan()?.currency ?? '');

  protected readonly total = computed(() => {
    const documents = this.documentsValue();
    const price = this.priceValue();
    return documents !== null && price !== null ? Math.round(documents * price * 100) / 100 : null;
  });

  protected readonly totalText = computed(() => {
    const total = this.total();
    return total === null ? '—' : this.money(total, this.plan()?.currency);
  });

  protected readonly valid = computed(() => !!this.plan() && this.total() !== null);

  constructor() {
    effect(() => {
      const only = this.paygPlans();
      if (only.length === 1 && this.planCode() === null) this.planCode.set(only[0].code);
    });
  }

  protected money(amount: number, currency: string | undefined): string {
    if (!currency) return new Intl.NumberFormat(this.locale, { maximumFractionDigits: 2 }).format(amount);
    try {
      return new Intl.NumberFormat(this.locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
    } catch {
      return `${new Intl.NumberFormat(this.locale, { maximumFractionDigits: 2 }).format(amount)} ${currency}`;
    }
  }

  protected submit(): void {
    const plan = this.plan();
    const documents = this.documentsValue();
    const unitPrice = this.priceValue();
    if (!plan || documents === null || unitPrice === null) return;
    this.submitted.emit({ planCode: plan.code, documents, unitPrice });
  }

  protected async copy(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }
}

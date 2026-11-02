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
import { formatDate } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { moneyExact } from '../../../shared/domain/money';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { FieldComponent } from '../../../shared/ui/field.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { OrgPickerComponent } from '../../../shared/ui/org-picker.component';
import { TextAreaComponent } from '../../../shared/ui/text-area.component';
import type { Invoice, InvoiceBody } from '../data/billing.models';
import { EMAIL_PATTERN, dayStart, invoiceTotalsOf, numberOf } from '../data/billing-view';
import { TaxLinesComponent, taxDraftValid, type TaxDraft } from './tax-lines.component';

const CURRENCY = /^[A-Za-z]{3}$/;

interface ItemDraft {
  concept: string;
  quantity: string;
  unitPrice: string;
}

const emptyItem = (): ItemDraft => ({ concept: '', quantity: '1', unitPrice: '' });

const itemValid = (item: ItemDraft): boolean => {
  const quantity = numberOf(item.quantity);
  const price = numberOf(item.unitPrice);
  return item.concept.trim().length > 0 && quantity > 0 && Number.isFinite(price) && price >= 0;
};

const itemUntouched = (item: ItemDraft): boolean =>
  item.concept.trim() === '' && item.unitPrice.trim() === '';

const valueOf = (text: string): string | undefined => text.trim() || undefined;

@Component({
  selector: 'dba-invoice-form',
  imports: [
    TranslatePipe,
    ButtonComponent,
    FieldComponent,
    IconComponent,
    ModalShellComponent,
    OrgPickerComponent,
    TaxLinesComponent,
    TextAreaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="note"
      [title]="(invoice() ? 'billing.form.editTitle' : 'billing.form.createTitle') | translate"
      [subtitle]="invoice()?.invoiceNumber ?? ''"
      [confirmLabel]="invoice() ? 'billing.form.save' : 'billing.form.create'"
      [confirmDisabled]="!valid()"
      [busy]="busy()"
      [maxWidth]="760"
      (confirmed)="submit()"
      (dismissed)="dismissed.emit()"
    >
      <div class="form">
        @if (canPickOrg() && !invoice()) {
          <div class="form__control">
            <span class="form__label">{{ 'billing.form.org' | translate }}</span>
            <dba-org-picker [value]="organization()" (picked)="organization.set($event)" />
            <span class="dba-meta">{{ 'billing.form.orgHint' | translate }}</span>
          </div>
        } @else if (invoice()?.organizationId) {
          <p class="dba-meta form__note">{{ 'billing.form.orgLocked' | translate }}</p>
        }

        <h3 class="dba-panel form__section">{{ 'billing.form.clientSection' | translate }}</h3>
        <div class="form__pair">
          <dba-field
            label="billing.form.clientName"
            [maxlength]="200"
            [hint]="hasOrganization() ? '' : 'billing.form.clientRequired'"
            [(value)]="clientName"
          />
          <dba-field label="billing.form.clientTaxId" [maxlength]="40" [(value)]="clientTaxId" />
        </div>
        <div class="form__pair">
          <dba-field
            label="billing.form.clientEmail"
            type="email"
            autocomplete="off"
            [hint]="hasOrganization() ? '' : 'billing.form.clientRequired'"
            [error]="emailProblem() ? 'billing.form.emailInvalid' : ''"
            [(value)]="clientEmail"
          />
          <dba-field label="billing.form.clientPhone" [maxlength]="40" [(value)]="clientPhone" />
        </div>
        <dba-field label="billing.form.clientAddress" [maxlength]="240" [(value)]="clientAddress" />

        <h3 class="dba-panel form__section">{{ 'billing.form.datesSection' | translate }}</h3>
        <div class="form__triple">
          <dba-field
            label="billing.form.currency"
            hint="billing.form.currencyHint"
            [maxlength]="3"
            [error]="currencyProblem() ? 'billing.form.currencyInvalid' : ''"
            [(value)]="currency"
          />
          <dba-field label="billing.form.issueDate" type="date" [(value)]="issueDate" />
          <dba-field
            label="billing.form.dueDate"
            type="date"
            [error]="dueProblem() ? 'billing.form.dueBeforeIssue' : ''"
            [(value)]="dueDate"
          />
        </div>

        <h3 class="dba-panel form__section">{{ 'billing.form.itemsSection' | translate }}</h3>
        @for (item of items(); track $index; let index = $index) {
          <div class="item">
            <dba-field
              class="item__concept"
              label="billing.form.concept"
              [maxlength]="240"
              [error]="itemProblem(item) ? 'billing.form.itemInvalid' : ''"
              [value]="item.concept"
              (valueChange)="setItem(index, { concept: $event })"
            />
            <dba-field
              label="billing.form.quantity"
              inputmode="decimal"
              [value]="item.quantity"
              (valueChange)="setItem(index, { quantity: $event })"
            />
            <dba-field
              label="billing.form.unitPrice"
              inputmode="decimal"
              [value]="item.unitPrice"
              (valueChange)="setItem(index, { unitPrice: $event })"
            />
            <button
              dba-button
              type="button"
              variant="secondary"
              class="item__remove"
              [disabled]="items().length === 1"
              [attr.aria-label]="'billing.form.removeItem' | translate"
              (click)="removeItem(index)"
            >
              <db-icon name="trash" [size]="15" />
            </button>
          </div>
        }
        <div>
          <button dba-button type="button" variant="secondary" (click)="addItem()">
            <db-icon name="plus" [size]="15" />
            {{ 'billing.form.addItem' | translate }}
          </button>
        </div>

        <h3 class="dba-panel form__section">{{ 'billing.form.taxesSection' | translate }}</h3>
        <dba-tax-lines [lines]="taxes()" (linesChange)="taxes.set($event)" />

        <dba-text-area label="billing.form.notes" [rows]="3" [maxlength]="1000" [(value)]="notes" />

        <dl class="totals">
          <dt>{{ 'billing.form.subtotal' | translate }}</dt>
          <dd>{{ money(totals().subtotal) }}</dd>
          <dt>{{ 'billing.form.taxesTotal' | translate }}</dt>
          <dd>{{ money(totals().taxes) }}</dd>
          <dt class="totals__strong">{{ 'billing.form.total' | translate }}</dt>
          <dd class="totals__strong">{{ money(totals().total) }}</dd>
        </dl>
      </div>
    </db-modal-shell>
  `,
  styleUrl: './invoice-form.component.scss',
})
export class InvoiceFormComponent implements OnInit {
  private readonly auth = inject(AuthStore);
  private readonly locale = inject(LOCALE_ID);

  readonly invoice = input<Invoice | null>(null);
  readonly busy = input(false);
  readonly submitted = output<InvoiceBody>();
  readonly dismissed = output<void>();

  protected readonly canPickOrg = computed(() => this.auth.canRead('clients'));
  protected readonly organization = signal<string | null>(null);
  protected readonly clientName = signal('');
  protected readonly clientTaxId = signal('');
  protected readonly clientEmail = signal('');
  protected readonly clientAddress = signal('');
  protected readonly clientPhone = signal('');
  protected readonly currency = signal('');
  protected readonly issueDate = signal('');
  protected readonly dueDate = signal('');
  protected readonly notes = signal('');
  protected readonly items = signal<ItemDraft[]>([emptyItem()]);
  protected readonly taxes = signal<TaxDraft[]>([]);

  protected readonly hasOrganization = computed(
    () => !!this.organization() || !!this.invoice()?.organizationId,
  );
  protected readonly emailProblem = computed(() => {
    const email = this.clientEmail().trim();
    return email !== '' && !EMAIL_PATTERN.test(email);
  });
  protected readonly currencyProblem = computed(() => {
    const currency = this.currency().trim();
    return currency !== '' && !CURRENCY.test(currency);
  });
  protected readonly dueProblem = computed(
    () => !!this.issueDate() && !!this.dueDate() && this.dueDate() < this.issueDate(),
  );
  protected readonly totals = computed(() =>
    invoiceTotalsOf(
      this.items()
        .filter(itemValid)
        .map((item) => ({
          quantity: numberOf(item.quantity),
          unitPrice: numberOf(item.unitPrice),
        })),
      this.taxes()
        .filter(taxDraftValid)
        .map((tax) => ({ amount: numberOf(tax.amount) })),
    ),
  );
  protected readonly valid = computed(
    () =>
      this.items().every(itemValid) &&
      this.taxes().every(taxDraftValid) &&
      !this.emailProblem() &&
      !this.currencyProblem() &&
      !this.dueProblem() &&
      (this.hasOrganization() ||
        (this.clientName().trim() !== '' && this.clientEmail().trim() !== '')) &&
      !this.busy(),
  );

  ngOnInit(): void {
    const invoice = this.invoice();
    if (!invoice) return;
    this.clientName.set(invoice.clientName);
    this.clientTaxId.set(invoice.clientTaxId ?? '');
    this.clientEmail.set(invoice.clientEmail);
    this.clientAddress.set(invoice.clientAddress ?? '');
    this.clientPhone.set(invoice.clientPhone ?? '');
    this.currency.set(invoice.currency);
    this.issueDate.set(this.dateOf(invoice.issueDate));
    this.dueDate.set(this.dateOf(invoice.dueDate));
    this.notes.set(invoice.notes ?? '');
    this.items.set(
      invoice.items.map((item) => ({
        concept: item.concept,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
      })),
    );
    this.taxes.set(invoice.taxes.map((tax) => ({ type: tax.type, amount: String(tax.amount) })));
  }

  protected money(amount: number): string {
    return moneyExact(amount, this.currency().trim().toUpperCase() || 'COP', this.locale);
  }

  protected itemProblem(item: ItemDraft): boolean {
    return !itemUntouched(item) && !itemValid(item);
  }

  protected setItem(index: number, change: Partial<ItemDraft>): void {
    this.items.update((items) =>
      items.map((item, at) => (at === index ? { ...item, ...change } : item)),
    );
  }

  protected addItem(): void {
    this.items.update((items) => [...items, emptyItem()]);
  }

  protected removeItem(index: number): void {
    this.items.update((items) => items.filter((_, at) => at !== index));
  }

  protected submit(): void {
    if (!this.valid()) return;
    this.submitted.emit({
      organizationId: this.invoice() ? undefined : (this.organization() ?? undefined),
      clientName: valueOf(this.clientName()),
      clientTaxId: valueOf(this.clientTaxId()),
      clientEmail: valueOf(this.clientEmail()),
      clientAddress: valueOf(this.clientAddress()),
      clientPhone: valueOf(this.clientPhone()),
      currency: valueOf(this.currency())?.toUpperCase(),
      items: this.items().map((item) => ({
        concept: item.concept.trim(),
        quantity: numberOf(item.quantity),
        unitPrice: numberOf(item.unitPrice),
      })),
      taxes: this.taxes().map((tax) => ({ type: tax.type.trim(), amount: numberOf(tax.amount) })),
      notes: valueOf(this.notes()),
      issueDate: this.issueDate() ? dayStart(this.issueDate()) : undefined,
      dueDate: this.dueDate() ? dayStart(this.dueDate()) : undefined,
    });
  }

  private dateOf(value?: string): string {
    return value ? formatDate(value, 'yyyy-MM-dd', this.locale) : '';
  }
}

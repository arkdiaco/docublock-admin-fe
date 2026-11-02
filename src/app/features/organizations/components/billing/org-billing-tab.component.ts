import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../../core/auth/auth.store';
import { sectionPath } from '../../../../core/layout/console-nav';
import {
  INVOICE_FAMILY,
  transactionFamilyOf,
  transactionStatusKey,
} from '../../../../shared/domain/billing-status';
import { moneyExact } from '../../../../shared/domain/money';
import { LatestRequest } from '../../../../shared/http/latest-request';
import { ButtonComponent } from '../../../../shared/ui/button.component';
import { IconComponent } from '../../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../../shared/ui/section-loader.component';
import { OrgBillingApi } from '../../data/org-billing.api';
import type { OrgInvoiceRow, OrgTransactionRow } from '../../data/org-billing.models';
import type { PlatformOrgDetail } from '../../data/organizations.models';

const RECENT = 5;

@Component({
  selector: 'dba-org-billing-tab',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    IconComponent,
    OrgStateComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'billing.orgTab.loading' | translate" />
    } @else if (error()) {
      <div class="ob__card ob__card--center">
        <p class="dba-body ob__text">{{ 'billing.orgTab.error' | translate }}</p>
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else {
      @if (canRegister()) {
        <div class="ob__actions">
          <a
            dba-button
            [routerLink]="billingPath"
            [queryParams]="{ organizacion: org().id, pago: 1 }"
          >
            <db-icon name="plus" [size]="15" />
            {{ 'billing.orgTab.register' | translate }}
          </a>
        </div>
      }
      <div class="ob__cols">
        <section class="ob__card">
          <h2 class="dba-panel">{{ 'billing.orgTab.transactions' | translate }}</h2>
          @if (transactions().length === 0) {
            <p class="dba-body ob__text">{{ 'billing.orgTab.noTransactions' | translate }}</p>
          } @else {
            <ul class="ob__list">
              @for (row of transactions(); track row.id) {
                <li>
                  <a class="ob__row" [routerLink]="[billingPath, row.id]">
                    <span class="ob__main">
                      <span class="ob__label">{{ row.planName }}</span>
                      <span class="ob__meta">{{ day(row.requestDate ?? row.createdAt) }}</span>
                    </span>
                    <code class="ob__amount">{{ amount(row.amountMajor, row.currency) }}</code>
                    <dba-org-state
                      [state]="familyOf(row.status)"
                      [labelKey]="statusKey(row.status)"
                      variant="inline"
                    />
                  </a>
                </li>
              }
            </ul>
            <a
              class="ob__more"
              [routerLink]="billingPath"
              [queryParams]="{ organizacion: org().id }"
              >{{ 'billing.orgTab.allTransactions' | translate }}</a
            >
          }
        </section>
        <section class="ob__card">
          <h2 class="dba-panel">{{ 'billing.orgTab.invoices' | translate }}</h2>
          @if (invoices().length === 0) {
            <p class="dba-body ob__text">{{ 'billing.orgTab.noInvoices' | translate }}</p>
          } @else {
            <ul class="ob__list">
              @for (row of invoices(); track row.id) {
                <li>
                  <a class="ob__row" [routerLink]="[billingPath, 'facturas', row.id]">
                    <span class="ob__main">
                      <span class="ob__label dba-mono">{{ row.invoiceNumber }}</span>
                      <span class="ob__meta">{{ day(row.issueDate) }}</span>
                    </span>
                    <code class="ob__amount">{{ amount(row.total, row.currency) }}</code>
                    <dba-org-state
                      [state]="invoiceFamily[row.status]"
                      [labelKey]="'billing.invStatus.' + row.status"
                      variant="inline"
                    />
                  </a>
                </li>
              }
            </ul>
            <a
              class="ob__more"
              [routerLink]="[billingPath, 'facturas']"
              [queryParams]="{ organizacion: org().id }"
              >{{ 'billing.orgTab.allInvoices' | translate }}</a
            >
          }
        </section>
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .ob__actions {
      display: flex;
      justify-content: flex-end;
    }

    .ob__cols {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      align-items: start;
    }

    .ob__card {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .ob__card--center {
      align-items: center;
    }

    .ob__card h2,
    .ob__text {
      margin: 0;
    }

    .ob__list {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .ob__row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 9px 0;
      border-bottom: 1px solid var(--dba-border-row);
      color: inherit;
      text-decoration: none;
    }

    .ob__row:hover .ob__label {
      color: var(--dba-violet-600);
    }

    .ob__main {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }

    .ob__label {
      overflow: hidden;
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ob__meta {
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }

    .ob__amount {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-id);
      color: var(--dba-ink);
      white-space: nowrap;
    }

    .ob__more {
      font-size: var(--dba-text-cell);
      color: var(--dba-violet-600);
      text-decoration: none;
    }

    .ob__more:hover {
      text-decoration: underline;
    }

    @media (max-width: 860px) {
      .ob__cols {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    @media (max-width: 520px) {
      .ob__row {
        flex-wrap: wrap;
      }

      .ob__main {
        flex-basis: 100%;
      }
    }
  `,
})
export class OrgBillingTabComponent {
  private readonly api = inject(OrgBillingApi);
  private readonly auth = inject(AuthStore);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  readonly org = input.required<PlatformOrgDetail>();

  protected readonly billingPath = sectionPath('billing');
  protected readonly familyOf = transactionFamilyOf;
  protected readonly statusKey = transactionStatusKey;
  protected readonly invoiceFamily = INVOICE_FAMILY;
  protected readonly canRegister = computed(
    () => this.auth.canManage('commercial') && this.auth.canRead('clients'),
  );

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly transactions = signal<OrgTransactionRow[]>([]);
  protected readonly invoices = signal<OrgInvoiceRow[]>([]);

  constructor() {
    effect(() => {
      void this.load(this.org().id);
    });
  }

  protected reload(): void {
    void this.load(this.org().id);
  }

  protected amount(value: number, currency: string): string {
    return moneyExact(value, currency, this.locale);
  }

  protected day(value?: string): string {
    return value ? formatDate(value, 'd/MM/y', this.locale) : '—';
  }

  private async load(id: string): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const [transactions, invoices] = await Promise.all([
        firstValueFrom(this.api.transactions(id, RECENT)),
        firstValueFrom(this.api.invoices(id, RECENT)),
      ]);
      if (!current()) return;
      this.transactions.set(transactions.items);
      this.invoices.set(invoices.items);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }
}

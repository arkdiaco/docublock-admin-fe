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
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import {
  INVOICE_FAMILY,
  transactionFamilyOf,
  transactionStatusKey,
  type TransactionStatus,
} from '../../../shared/domain/billing-status';
import { moneyExact } from '../../../shared/domain/money';
import { PendingAction } from '../../../shared/domain/pending-action';
import { errorCodeOf, errorStatusOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { RecordHeaderComponent } from '../../../shared/ui/record-header.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import {
  UnderlineTabsComponent,
  type UnderlineTab,
} from '../../../shared/ui/underline-tabs.component';
import { BillingApi } from '../data/billing.api';
import { BILLING_ERRORS } from '../data/billing-errors';
import type { TransactionDetail } from '../data/billing.models';
import {
  allowedNextOf,
  canCreateInvoice,
  canToggleInvoiced,
  isManualInterval,
} from '../data/billing-view';

const TAB_KEYS = ['payment', 'invoice'] as const;

interface StoredTax {
  type?: string;
  amount_in_cents?: number;
  amount?: number;
}

@Component({
  selector: 'dba-transaction-detail',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    EmptyStateComponent,
    OrgStateComponent,
    RecordHeaderComponent,
    SectionLoaderComponent,
    UnderlineTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'billing.td.loading' | translate" />
    } @else if (missing()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="billing.td.missingTitle" leadKey="billing.td.missingLead" />
        <a dba-button variant="secondary" [routerLink]="billingPath">{{
          'billing.td.back' | translate
        }}</a>
      </div>
    } @else if (error()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="billing.td.errorTitle" leadKey="billing.td.errorLead" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (detail(); as tx) {
      <div class="bd">
        <dba-record-header
          initials="TX"
          [title]="tx.reference || tx.idTransaction"
          [state]="familyOf(tx.status)"
          [stateLabelKey]="statusKey(tx.status)"
          [meta]="meta()"
        />

        @if (canManage() && (nextStatuses().length > 0 || canToggle())) {
          <div class="bd__actions">
            @for (next of nextStatuses(); track next) {
              <button
                dba-button
                [variant]="
                  next === 'APPROVED' ? 'primary' : next === 'VOIDED' ? 'destructive' : 'secondary'
                "
                [busy]="pending.key() === next"
                [disabled]="!!pending.key()"
                (click)="changeStatus(next)"
              >
                {{ 'billing.td.act.' + next + '.label' | translate }}
              </button>
            }
            @if (canToggle()) {
              <button
                dba-button
                variant="secondary"
                [busy]="pending.key() === 'invoiced'"
                [disabled]="!!pending.key()"
                (click)="toggleInvoiced()"
              >
                {{ 'billing.td.act.' + toggleKey() + '.label' | translate }}
              </button>
            }
          </div>
        }

        <db-underline-tabs [tabs]="tabs()" [active]="tab()" (picked)="tab.set($event)" />

        @if (tab() === 'payment') {
          <div class="bd__cols">
            <section class="bd__card">
              <h2 class="dba-panel">{{ 'billing.td.tab.payment' | translate }}</h2>
              <dl class="bd__dl">
                <dt>{{ 'billing.td.field.amount' | translate }}</dt>
                <dd class="dba-mono">{{ amountText() }}</dd>
                <dt>{{ 'billing.td.field.taxes' | translate }}</dt>
                <dd>{{ taxesText() }}</dd>
                <dt>{{ 'billing.td.field.source' | translate }}</dt>
                <dd>{{ 'billing.source.' + tx.source | translate }}</dd>
                <dt>{{ 'billing.td.field.method' | translate }}</dt>
                <dd>{{ tx.paymentMethod || '—' }}</dd>
                <dt>{{ 'billing.td.field.promo' | translate }}</dt>
                <dd>
                  @if (tx.promotionalCode; as promo) {
                    {{
                      'billing.td.promoValue'
                        | translate: { code: promo.code, discount: promo.discount }
                    }}
                  } @else {
                    —
                  }
                </dd>
                <dt>{{ 'billing.td.field.requested' | translate }}</dt>
                <dd class="dba-mono">{{ stamp(tx.requestDate) }}</dd>
              </dl>
            </section>
            <section class="bd__card">
              <h2 class="dba-panel">{{ 'billing.td.field.plan' | translate }}</h2>
              <dl class="bd__dl">
                <dt>{{ 'billing.td.field.org' | translate }}</dt>
                <dd>
                  @if (canOpenOrg()) {
                    <a class="bd__link" [routerLink]="[orgsPath, tx.organization.id]">{{
                      tx.organization.name
                    }}</a>
                  } @else {
                    {{ tx.organization.name }}
                  }
                </dd>
                <dt>{{ 'billing.td.field.plan' | translate }}</dt>
                <dd>{{ tx.planName }}</dd>
                <dt>{{ 'billing.td.field.interval' | translate }}</dt>
                <dd>{{ intervalText() }}</dd>
                <dt>{{ 'billing.td.field.documents' | translate }}</dt>
                <dd class="dba-mono">{{ tx.documents ?? '—' }}</dd>
                <dt>{{ 'billing.td.field.id' | translate }}</dt>
                <dd class="dba-mono">{{ tx.idTransaction }}</dd>
                @if (tx.alohapayId) {
                  <dt>{{ 'billing.td.field.link' | translate }}</dt>
                  <dd class="dba-mono">{{ tx.alohapayId }}</dd>
                }
                @if (tx.liveStatus) {
                  <dt>{{ 'billing.td.field.live' | translate }}</dt>
                  <dd class="dba-mono">{{ tx.liveStatus }}</dd>
                }
                <dt>{{ 'billing.td.field.events' | translate }}</dt>
                <dd class="dba-mono">{{ tx.webhookEventIds.length }}</dd>
              </dl>
            </section>
          </div>
        } @else {
          <section class="bd__card">
            @if (tx.invoice; as invoice) {
              <dl class="bd__dl">
                <dt>{{ 'billing.td.tab.invoice' | translate }}</dt>
                <dd class="dba-mono">{{ invoice.invoiceNumber }}</dd>
                <dt>{{ 'billing.td.field.invoiced' | translate }}</dt>
                <dd>
                  <dba-org-state
                    [state]="invoiceFamily[invoice.status]"
                    [labelKey]="'billing.invStatus.' + invoice.status"
                    variant="inline"
                  />
                </dd>
              </dl>
              <div>
                <a
                  dba-button
                  variant="secondary"
                  [routerLink]="[billingPath, 'facturas', invoice.id]"
                >
                  {{ 'billing.td.invoiceOpen' | translate }}
                </a>
              </div>
            } @else {
              <p class="dba-body bd__note">{{ invoiceNote() | translate }}</p>
              @if (canManage() && canInvoice()) {
                <div>
                  <button
                    dba-button
                    [busy]="pending.key() === 'invoice'"
                    [disabled]="!!pending.key()"
                    (click)="createInvoice()"
                  >
                    {{ 'billing.td.invoiceCreate' | translate }}
                  </button>
                </div>
              }
            }
          </section>
        }
      </div>
    }
  `,
  styleUrl: '../components/billing-detail.scss',
})
export class TransactionDetailComponent {
  readonly id = input.required<string>();

  private readonly api = inject(BillingApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly billingPath = sectionPath('billing');
  protected readonly orgsPath = sectionPath('organizations');
  protected readonly familyOf = transactionFamilyOf;
  protected readonly statusKey = transactionStatusKey;
  protected readonly invoiceFamily = INVOICE_FAMILY;
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('commercial'));
  protected readonly canOpenOrg = computed(() => this.auth.canRead('clients'));

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly missing = signal(false);
  protected readonly detail = signal<TransactionDetail | null>(null);
  protected readonly tab = signal<string>('payment');

  protected readonly nextStatuses = computed(() => {
    const tx = this.detail();
    return tx ? allowedNextOf(tx.status) : [];
  });
  protected readonly canToggle = computed(() => {
    const tx = this.detail();
    return !!tx && canToggleInvoiced(tx);
  });
  protected readonly canInvoice = computed(() => {
    const tx = this.detail();
    return !!tx && canCreateInvoice(tx);
  });
  protected readonly toggleKey = computed(() =>
    this.detail()?.invoiced ? 'unmarkInvoiced' : 'markInvoiced',
  );
  protected readonly amountText = computed(() => {
    const tx = this.detail();
    return tx ? moneyExact(tx.amountMajor, tx.currency, this.locale) : '';
  });
  protected readonly intervalText = computed(() => {
    const duration = this.detail()?.planDuration ?? '';
    return isManualInterval(duration)
      ? this.label(`billing.interval.${duration}`)
      : duration || '—';
  });
  protected readonly taxesText = computed(() => {
    const tx = this.detail();
    if (!tx || tx.taxes.length === 0) return '—';
    return (tx.taxes as StoredTax[])
      .filter((tax) => typeof tax.type === 'string')
      .map((tax) => {
        const amount = tax.amount_in_cents !== undefined ? tax.amount_in_cents / 100 : tax.amount;
        return `${tax.type}: ${moneyExact(amount ?? 0, tx.currency, this.locale)}`;
      })
      .join(' · ');
  });
  protected readonly meta = computed(() => {
    const tx = this.detail();
    if (!tx) return '';
    return [this.amountText(), tx.organization.name, this.stamp(tx.requestDate)].join(' · ');
  });
  protected readonly invoiceNote = computed(() => {
    const tx = this.detail();
    if (tx?.invoiced) return 'billing.td.invoiceOutside';
    return tx?.status === 'APPROVED' ? 'billing.td.invoiceNone' : 'billing.td.invoiceNotApproved';
  });
  protected readonly tabs = computed<UnderlineTab[]>(() =>
    TAB_KEYS.map((key) => ({ key, label: this.label(`billing.td.tab.${key}`) })),
  );

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.load(id, true);
    });
  }

  protected reload(): void {
    void this.load(this.id(), true);
  }

  protected stamp(value?: string): string {
    return value ? formatDate(value, 'd/MM/y HH:mm', this.locale) : '—';
  }

  protected async changeStatus(next: TransactionStatus): Promise<void> {
    const tx = this.detail();
    if (!tx) return;
    await this.act(next, {
      intent: next === 'APPROVED' ? 'primary' : 'danger',
      prefix: `billing.td.act.${next}`,
      params: { org: tx.organization.name },
      request: this.api.setStatus(tx.id, next),
    });
  }

  protected async toggleInvoiced(): Promise<void> {
    const tx = this.detail();
    if (!tx) return;
    await this.act('invoiced', {
      intent: 'primary',
      prefix: `billing.td.act.${this.toggleKey()}`,
      params: {},
      request: this.api.setInvoiced(tx.id, !tx.invoiced),
    });
  }

  protected async createInvoice(): Promise<void> {
    const tx = this.detail();
    if (!tx) return;
    await this.pending.run('invoice', async () => {
      try {
        const invoice = await firstValueFrom(this.api.invoiceFromTransaction(tx.id));
        this.notify.success(
          this.label('billing.td.act.invoice.done', { number: invoice.invoiceNumber }),
        );
        void this.router.navigate([this.billingPath, 'facturas', invoice.id]);
      } catch (error) {
        this.fail(error);
      }
    });
  }

  private async act(
    key: string,
    action: {
      intent: 'primary' | 'danger';
      prefix: string;
      params: Record<string, string>;
      request: Observable<unknown>;
    },
  ): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      intent: action.intent,
      icon: action.intent === 'danger' ? 'triangleAlert' : 'circleCheck',
      title: `${action.prefix}.title`,
      message: `${action.prefix}.message`,
      params: action.params,
      confirmLabel: `${action.prefix}.confirm`,
    });
    if (!confirmed) return;
    await this.pending.run(key, async () => {
      try {
        await firstValueFrom(action.request);
        this.notify.success(this.label(`${action.prefix}.done`));
        await this.load(this.id(), false);
      } catch (error) {
        this.fail(error);
        await this.load(this.id(), false);
      }
    });
  }

  private fail(error: unknown): void {
    const code = errorCodeOf(error);
    const known = code !== null && BILLING_ERRORS.includes(code);
    this.notify.error(this.label(known ? `billing.error.${code}` : 'billing.error.generic'));
  }

  private async load(id: string, initial: boolean): Promise<void> {
    const current = this.latest.start();
    if (initial) {
      this.loading.set(true);
      this.error.set(false);
      this.missing.set(false);
    }
    try {
      const tx = await firstValueFrom(this.api.transaction(id));
      if (!current()) return;
      this.detail.set(tx);
    } catch (error) {
      if (!current()) return;
      if (initial) {
        if (errorStatusOf(error) === 404) this.missing.set(true);
        else this.error.set(true);
      } else {
        this.notify.error(this.label('billing.td.refreshError'));
      }
    }
    this.loading.set(false);
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}

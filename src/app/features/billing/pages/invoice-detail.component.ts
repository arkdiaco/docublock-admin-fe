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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { INVOICE_FAMILY } from '../../../shared/domain/billing-status';
import { moneyExact } from '../../../shared/domain/money';
import { PendingAction } from '../../../shared/domain/pending-action';
import { errorCodeOf, errorStatusOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { RecordHeaderComponent } from '../../../shared/ui/record-header.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { InvoiceFormComponent } from '../components/invoice-form.component';
import { InvoiceSendFormComponent } from '../components/invoice-send-form.component';
import { BillingApi } from '../data/billing.api';
import { BILLING_ERRORS } from '../data/billing-errors';
import type { Invoice, InvoiceBody } from '../data/billing.models';

const REVOKE_AFTER_MS = 60_000;

@Component({
  selector: 'dba-invoice-detail',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    EmptyStateComponent,
    IconComponent,
    RecordHeaderComponent,
    SectionLoaderComponent,
    InvoiceFormComponent,
    InvoiceSendFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'billing.id.loading' | translate" />
    } @else if (missing()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="billing.id.missingTitle" leadKey="billing.id.missingLead" />
        <a dba-button variant="secondary" [routerLink]="[billingPath, 'facturas']">{{
          'billing.id.back' | translate
        }}</a>
      </div>
    } @else if (error()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="billing.id.errorTitle" leadKey="billing.id.errorLead" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (invoice(); as inv) {
      <div class="bd">
        <dba-record-header
          initials="FA"
          [title]="inv.invoiceNumber"
          [state]="family[inv.status]"
          [stateLabelKey]="'billing.invStatus.' + inv.status"
          [meta]="meta()"
        />

        <div class="bd__actions">
          <button
            dba-button
            variant="secondary"
            [busy]="pending.key() === 'pdf'"
            [disabled]="!!pending.key()"
            (click)="openPdf()"
          >
            <db-icon name="eye" [size]="15" />
            {{ 'billing.id.pdf' | translate }}
          </button>
          @if (canManage() && inv.status === 'draft') {
            <button
              dba-button
              variant="secondary"
              [disabled]="!!pending.key()"
              (click)="formOpen.set(true)"
            >
              <db-icon name="pencil" [size]="15" />
              {{ 'billing.id.edit' | translate }}
            </button>
          }
          @if (canManage() && inv.status !== 'void') {
            <button dba-button [disabled]="!!pending.key()" (click)="sendOpen.set(true)">
              <db-icon name="send" [size]="15" />
              {{ (inv.status === 'sent' ? 'billing.id.resend' : 'billing.id.send') | translate }}
            </button>
            <button
              dba-button
              variant="destructive"
              [busy]="pending.key() === 'void'"
              [disabled]="!!pending.key()"
              (click)="voidInvoice()"
            >
              {{ 'billing.id.void.label' | translate }}
            </button>
          }
        </div>

        <div class="bd__cols">
          <section class="bd__card">
            <h2 class="dba-panel">{{ 'billing.id.section.client' | translate }}</h2>
            <dl class="bd__dl">
              <dt>{{ 'billing.id.field.name' | translate }}</dt>
              <dd>{{ inv.clientName }}</dd>
              <dt>{{ 'billing.id.field.taxId' | translate }}</dt>
              <dd class="dba-mono">{{ inv.clientTaxId || '—' }}</dd>
              <dt>{{ 'billing.id.field.email' | translate }}</dt>
              <dd>{{ inv.clientEmail }}</dd>
              <dt>{{ 'billing.id.field.address' | translate }}</dt>
              <dd>{{ inv.clientAddress || '—' }}</dd>
              <dt>{{ 'billing.id.field.phone' | translate }}</dt>
              <dd>{{ inv.clientPhone || '—' }}</dd>
              @if (inv.organizationId && canOpenOrg()) {
                <dt>{{ 'billing.id.field.org' | translate }}</dt>
                <dd>
                  <a class="bd__link" [routerLink]="[orgsPath, inv.organizationId]">{{
                    'billing.id.orgOpen' | translate
                  }}</a>
                </dd>
              }
            </dl>
          </section>
          <section class="bd__card">
            <h2 class="dba-panel">{{ 'billing.id.section.info' | translate }}</h2>
            <dl class="bd__dl">
              <dt>{{ 'billing.id.field.issued' | translate }}</dt>
              <dd class="dba-mono">{{ day(inv.issueDate) }}</dd>
              <dt>{{ 'billing.id.field.due' | translate }}</dt>
              <dd class="dba-mono">{{ day(inv.dueDate) }}</dd>
              <dt>{{ 'billing.id.field.currency' | translate }}</dt>
              <dd class="dba-mono">{{ inv.currency }}</dd>
              <dt>{{ 'billing.id.field.sentAt' | translate }}</dt>
              <dd class="dba-mono">{{ stamp(inv.sentAt) }}</dd>
              <dt>{{ 'billing.id.field.sentTo' | translate }}</dt>
              <dd>{{ inv.sentTo || '—' }}</dd>
              @if (inv.transactionId) {
                <dt>{{ 'billing.id.field.transaction' | translate }}</dt>
                <dd>
                  <a class="bd__link" [routerLink]="[billingPath, inv.transactionId]">{{
                    'billing.id.transactionOpen' | translate
                  }}</a>
                </dd>
              }
              @if (inv.externalRef) {
                <dt>{{ 'billing.id.field.externalRef' | translate }}</dt>
                <dd class="dba-mono">{{ inv.externalRef }}</dd>
              }
            </dl>
          </section>
        </div>

        <section class="bd__card">
          <h2 class="dba-panel">{{ 'billing.id.section.detail' | translate }}</h2>
          <div
            class="lines"
            role="table"
            [attr.aria-label]="'billing.id.section.detail' | translate"
          >
            <div class="lines__row lines__row--head" role="row">
              <span role="columnheader">{{ 'billing.id.col.concept' | translate }}</span>
              <span role="columnheader" class="lines__num">{{
                'billing.id.col.quantity' | translate
              }}</span>
              <span role="columnheader" class="lines__num">{{
                'billing.id.col.unitPrice' | translate
              }}</span>
              <span role="columnheader" class="lines__num">{{
                'billing.id.col.amount' | translate
              }}</span>
            </div>
            @for (item of inv.items; track $index) {
              <div class="lines__row" role="row">
                <span role="cell">{{ item.concept }}</span>
                <span role="cell" class="lines__num">{{ item.quantity }}</span>
                <span role="cell" class="lines__num">{{ money(item.unitPrice) }}</span>
                <span role="cell" class="lines__num">{{ money(item.amount) }}</span>
              </div>
            }
          </div>
          <dl class="sums">
            <dt>{{ 'billing.id.subtotal' | translate }}</dt>
            <dd>{{ money(subtotal()) }}</dd>
            @for (tax of inv.taxes; track $index) {
              <dt>{{ tax.type }}</dt>
              <dd>{{ money(tax.amount) }}</dd>
            }
            <dt class="sums__strong">{{ 'billing.id.total' | translate }}</dt>
            <dd class="sums__strong">{{ money(inv.total) }}</dd>
          </dl>
        </section>

        @if (inv.notes) {
          <section class="bd__card">
            <h2 class="dba-panel">{{ 'billing.id.section.notes' | translate }}</h2>
            <p class="dba-body bd__note">{{ inv.notes }}</p>
          </section>
        }
      </div>

      @if (formOpen()) {
        <dba-invoice-form
          [invoice]="inv"
          [busy]="pending.key() === 'save'"
          (submitted)="save($event)"
          (dismissed)="formOpen.set(false)"
        />
      }
      @if (sendOpen()) {
        <dba-invoice-send-form
          [number]="inv.invoiceNumber"
          [initialEmail]="inv.sentTo || inv.clientEmail"
          [busy]="pending.key() === 'send'"
          (submitted)="send($event)"
          (dismissed)="sendOpen.set(false)"
        />
      }
    }
  `,
  styleUrl: './invoice-detail.component.scss',
})
export class InvoiceDetailComponent {
  readonly id = input.required<string>();

  private readonly api = inject(BillingApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly billingPath = sectionPath('billing');
  protected readonly orgsPath = sectionPath('organizations');
  protected readonly family = INVOICE_FAMILY;
  protected readonly pending = new PendingAction();
  protected readonly canManage = computed(() => this.auth.canManage('commercial'));
  protected readonly canOpenOrg = computed(() => this.auth.canRead('clients'));

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly missing = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly sendOpen = signal(false);
  protected readonly invoice = signal<Invoice | null>(null);

  protected readonly subtotal = computed(() => {
    const inv = this.invoice();
    if (!inv) return 0;
    return inv.subtotal ?? inv.items.reduce((sum, item) => sum + item.amount, 0);
  });
  protected readonly meta = computed(() => {
    const inv = this.invoice();
    return inv ? `${inv.clientName} · ${this.money(inv.total)}` : '';
  });

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.load(id, true);
    });
  }

  protected reload(): void {
    void this.load(this.id(), true);
  }

  protected money(amount: number): string {
    return moneyExact(amount, this.invoice()?.currency ?? 'COP', this.locale);
  }

  protected day(value?: string): string {
    return value ? formatDate(value, 'd/MM/y', this.locale) : '—';
  }

  protected stamp(value?: string): string {
    return value ? formatDate(value, 'd/MM/y HH:mm', this.locale) : '—';
  }

  protected async openPdf(): Promise<void> {
    const tab = window.open('', '_blank');
    await this.pending.run('pdf', async () => {
      try {
        const blob = await firstValueFrom(this.api.invoicePdf(this.id()));
        const url = URL.createObjectURL(blob);
        if (tab) tab.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
      } catch {
        tab?.close();
        this.notify.error(this.label('billing.error.PDF'));
      }
    });
  }

  protected async save(body: InvoiceBody): Promise<void> {
    await this.pending.run('save', async () => {
      try {
        const invoice = await firstValueFrom(this.api.updateInvoice(this.id(), body));
        this.invoice.set(invoice);
        this.formOpen.set(false);
        this.notify.success(this.label('billing.form.saveDone'));
      } catch (error) {
        await this.failAndRefresh(error);
      }
    });
  }

  protected async send(email: string): Promise<void> {
    await this.pending.run('send', async () => {
      try {
        const invoice = await firstValueFrom(this.api.sendInvoice(this.id(), email));
        this.invoice.set(invoice);
        this.sendOpen.set(false);
        this.notify.success(this.label('billing.id.sendForm.done', { email }));
      } catch (error) {
        await this.failAndRefresh(error);
      }
    });
  }

  protected async voidInvoice(): Promise<void> {
    const inv = this.invoice();
    if (!inv) return;
    const confirmed = await this.dialogs.confirm({
      intent: 'danger',
      icon: 'triangleAlert',
      title: 'billing.id.void.title',
      message: 'billing.id.void.message',
      params: { number: inv.invoiceNumber },
      confirmLabel: 'billing.id.void.confirm',
    });
    if (!confirmed) return;
    await this.pending.run('void', async () => {
      try {
        const invoice = await firstValueFrom(this.api.voidInvoice(inv.id));
        this.invoice.set(invoice);
        this.notify.success(this.label('billing.id.void.done'));
      } catch (error) {
        await this.failAndRefresh(error);
      }
    });
  }

  private async failAndRefresh(error: unknown): Promise<void> {
    const code = errorCodeOf(error);
    const known = code !== null && BILLING_ERRORS.includes(code);
    this.notify.error(this.label(known ? `billing.error.${code}` : 'billing.error.generic'));
    await this.load(this.id(), false);
  }

  private async load(id: string, initial: boolean): Promise<void> {
    const current = this.latest.start();
    if (initial) {
      this.loading.set(true);
      this.error.set(false);
      this.missing.set(false);
    }
    try {
      const invoice = await firstValueFrom(this.api.invoice(id));
      if (!current()) return;
      this.invoice.set(invoice);
    } catch (error) {
      if (!current()) return;
      if (initial) {
        if (errorStatusOf(error) === 404) this.missing.set(true);
        else this.error.set(true);
      } else {
        this.notify.error(this.label('billing.id.refreshError'));
      }
    }
    this.loading.set(false);
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}

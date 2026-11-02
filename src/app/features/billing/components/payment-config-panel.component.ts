import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type OnInit,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { BillingApi } from '../data/billing.api';
import type { GatewayConfigStatus, PaymentConfigStatus } from '../data/billing.models';

const GATEWAY_ROWS: readonly { key: keyof GatewayConfigStatus; labelKey: string }[] = [
  { key: 'stripeConfigured', labelKey: 'billing.config.stripe' },
  { key: 'webhookSecretConfigured', labelKey: 'billing.config.stripeWebhook' },
  { key: 'alohapayConfigured', labelKey: 'billing.config.alohapay' },
  { key: 'alohapayWebhookConfigured', labelKey: 'billing.config.alohapayWebhook' },
  { key: 'forwardSigningConfigured', labelKey: 'billing.config.forwardSigning' },
  { key: 'coreForwardTarget', labelKey: 'billing.config.coreTarget' },
];

@Component({
  selector: 'dba-payment-config-panel',
  imports: [TranslatePipe, OrgStateComponent, SectionLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cfg">
      <header class="cfg__head">
        <h2 class="dba-panel">{{ 'billing.config.title' | translate }}</h2>
        <span class="dba-meta">{{ 'billing.config.lead' | translate }}</span>
      </header>
      @if (loading()) {
        <db-section-loader [label]="'billing.config.loading' | translate" />
      } @else if (error()) {
        <p class="dba-body cfg__note">{{ 'billing.config.error' | translate }}</p>
      } @else if (status(); as config) {
        <ul class="cfg__list">
          @if (config.gateways === null) {
            <li class="cfg__row">
              <span class="cfg__label">{{ 'billing.config.gatewaysUnavailable' | translate }}</span>
            </li>
          } @else {
            @for (row of gatewayRows(); track row.labelKey) {
              <li class="cfg__row">
                <span class="cfg__label">{{ row.labelKey | translate }}</span>
                <dba-org-state
                  [state]="row.ok ? 'active' : 'warning'"
                  [labelKey]="row.ok ? 'billing.config.ok' : 'billing.config.missing'"
                  variant="inline"
                />
              </li>
            }
          }
          <li class="cfg__row">
            <span class="cfg__copy">
              <span class="cfg__label">{{ 'billing.config.issuer' | translate }}</span>
              @if (issuerMissing()) {
                <span class="dba-meta">{{
                  'billing.config.issuerMissing' | translate: { fields: issuerMissing() }
                }}</span>
              }
            </span>
            <dba-org-state
              [state]="issuerMissing() ? 'warning' : 'active'"
              [labelKey]="issuerMissing() ? 'billing.config.missing' : 'billing.config.ok'"
              variant="inline"
            />
          </li>
        </ul>
      }
    </section>
  `,
  styles: `
    .cfg {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .cfg__head {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .cfg__head h2,
    .cfg__note {
      margin: 0;
    }

    .cfg__list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: 32px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .cfg__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-width: 0;
      padding: 9px 0;
      border-bottom: 1px solid var(--dba-border-row);
    }

    .cfg__copy {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .cfg__label {
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
    }

    @media (max-width: 760px) {
      .cfg__list {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class PaymentConfigPanelComponent implements OnInit {
  private readonly api = inject(BillingApi);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly status = signal<PaymentConfigStatus | null>(null);

  protected readonly gatewayRows = computed(() => {
    const gateways = this.status()?.gateways;
    return gateways
      ? GATEWAY_ROWS.map((row) => ({ labelKey: row.labelKey, ok: gateways[row.key] }))
      : [];
  });
  protected readonly issuerMissing = computed(() =>
    (this.status()?.issuerMissing ?? [])
      .map((field) => this.translate.instant(`billing.config.issuerField.${field}`) as string)
      .join(', '),
  );

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.status.set(await firstValueFrom(this.api.paymentConfig()));
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}

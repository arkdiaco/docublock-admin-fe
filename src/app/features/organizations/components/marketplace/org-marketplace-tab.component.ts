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
  untracked,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { AuthStore } from '../../../../core/auth/auth.store';
import { DialogService } from '../../../../core/ui/dialog.service';
import { NotificationService } from '../../../../core/ui/notification.service';
import { money } from '../../../../shared/domain/money';
import { errorCodeOf } from '../../../../shared/http/error-code';
import { LatestRequest } from '../../../../shared/http/latest-request';
import {
  ActionMenuComponent,
  type ActionMenuItem,
} from '../../../../shared/ui/action-menu.component';
import { ButtonComponent } from '../../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../../shared/ui/section-loader.component';
import { OrgMarketplaceApi } from '../../data/org-marketplace.api';
import type { OrgAddon, OrgProductPrice, OverrideBody } from '../../data/org-marketplace.models';
import type { PlatformOrgDetail } from '../../data/organizations.models';
import { OverrideFormComponent } from './override-form.component';

const PRICE_COLUMNS: readonly DataColumn[] = [
  { key: 'product', labelKey: 'orgMkt.col.product', width: 'minmax(0, 1.5fr)' },
  { key: 'general', labelKey: 'orgMkt.col.general', width: '150px', align: 'end' },
  { key: 'effective', labelKey: 'orgMkt.col.effective', width: '150px', align: 'end' },
  { key: 'tiers', labelKey: 'orgMkt.col.tiers', width: 'minmax(0, 1fr)' },
  { key: 'tax', labelKey: 'orgMkt.col.tax', width: '70px', align: 'end' },
  { key: 'actions', width: '48px', align: 'end' },
];

const ADDON_COLUMNS: readonly DataColumn[] = [
  { key: 'addon', labelKey: 'orgMkt.col.addon', width: 'minmax(0, 1.4fr)' },
  { key: 'state', labelKey: 'orgMkt.col.state', width: '200px' },
  { key: 'source', labelKey: 'orgMkt.col.source', width: '130px' },
  { key: 'price', labelKey: 'orgMkt.col.monthly', width: '150px', align: 'end' },
  { key: 'period', labelKey: 'orgMkt.col.period', width: '130px' },
  { key: 'actions', width: '48px', align: 'end' },
];

export const ORG_MARKET_ERRORS = [
  'ADDON_COBRADO_POR_STRIPE',
  'ADDON_NO_COBRADO_POR_STRIPE',
  'ADDON_NO_DISPONIBLE_EN_PAIS',
  'PRODUCTO_NO_ENCONTRADO',
  'PRODUCTO_NO_DISPONIBLE_EN_PAIS',
  'PRODUCTO_DATOS_INVALIDOS',
];

export const addonFamily = (addon: OrgAddon): string => {
  if (addon.state === 'PENDING') return 'trial';
  if (addon.state !== 'ACTIVE') return 'closed';
  return addon.cancelAtPeriodEnd ? 'warning' : 'active';
};

export const addonStateKey = (addon: OrgAddon): string =>
  addon.state === 'ACTIVE' && addon.cancelAtPeriodEnd
    ? 'orgMkt.addonState.CANCELLING'
    : 'orgMkt.addonState.' + addon.state;

export const addonActions = (addon: OrgAddon): ActionMenuItem[] => {
  if (addon.state !== 'ACTIVE') {
    return addon.onSale ? [{ key: 'activate', labelKey: 'orgMkt.action.activate' }] : [];
  }
  if (addon.source === 'STRIPE') {
    return addon.cancelAtPeriodEnd
      ? []
      : [{ key: 'cancel', labelKey: 'orgMkt.action.cancel', danger: true }];
  }
  return [{ key: 'deactivate', labelKey: 'orgMkt.action.deactivate', danger: true }];
};

export const priceActions = (price: OrgProductPrice): ActionMenuItem[] => [
  {
    key: 'override',
    labelKey: price.overridden ? 'orgMkt.action.editOverride' : 'orgMkt.action.override',
  },
  ...(price.overridden
    ? [{ key: 'remove', labelKey: 'orgMkt.action.remove', danger: true, separated: true }]
    : []),
];

const REASON = {
  labelKey: 'orgMkt.f.reason',
  placeholder: 'orgMkt.f.reasonPlaceholder',
  limit: 500,
  quick: [],
  required: true,
};

type Target = { kind: 'price'; price: OrgProductPrice } | { kind: 'addon'; addon: OrgAddon } | null;

@Component({
  selector: 'dba-org-marketplace-tab',
  imports: [
    TranslatePipe,
    ActionMenuComponent,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    IconComponent,
    OrgStateComponent,
    SectionLoaderComponent,
    OverrideFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'orgMkt.loading' | translate" />
    } @else if (error()) {
      <div class="mt__panel">
        <dba-empty-state titleKey="orgMkt.errorTitle" leadKey="orgMkt.errorLead" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else {
      <div class="mt">
        <section class="mt__card">
          <header class="mt__head">
            <h2 class="dba-panel">{{ 'orgMkt.prices' | translate }}</h2>
            <p class="dba-meta mt__lead">{{ 'orgMkt.pricesLead' | translate }}</p>
          </header>
          @if (prices().length === 0) {
            <p class="dba-body mt__muted">{{ 'orgMkt.noPrices' | translate }}</p>
          } @else {
            <dba-data-table
              [columns]="priceColumns"
              [label]="'orgMkt.prices' | translate"
              minWidth="820px"
            >
              @for (price of prices(); track price.productCode) {
                <div class="dba-tr">
                  <span class="dba-td cell">
                    <span class="cell__name">{{ price.name }}</span>
                    <span class="cell__code">{{ price.productCode }}</span>
                  </span>
                  <span class="dba-td dba-td--end dba-mono mt__small">{{
                    amount(price.generalUnitPrice, price.currency)
                  }}</span>
                  <span class="dba-td dba-td--end cell cell--end">
                    <span class="dba-mono mt__small" [class.mt__special]="price.overridden">{{
                      amount(price.unitPrice, price.currency)
                    }}</span>
                    @if (price.overridden) {
                      <span class="dba-meta">{{ 'orgMkt.special' | translate }}</span>
                    }
                  </span>
                  <span class="dba-td cell">
                    <span class="mt__small">{{ tiersOf(price) }}</span>
                    @if (price.note) {
                      <span class="dba-meta mt__clip">{{ price.note }}</span>
                    }
                  </span>
                  <code class="dba-td dba-td--end">{{ price.taxPct }} %</code>
                  <span class="dba-td dba-td--end">
                    @if (canManage()) {
                      <button
                        type="button"
                        class="mt__more"
                        [attr.aria-label]="'orgMkt.actionsFor' | translate: { name: price.name }"
                        (click)="openPrice(price, $event, priceMenu)"
                      >
                        <db-icon name="moreVertical" [size]="16" />
                      </button>
                    }
                  </span>
                </div>
              }
            </dba-data-table>
          }
        </section>

        <section class="mt__card">
          <header class="mt__head">
            <h2 class="dba-panel">{{ 'orgMkt.addons' | translate }}</h2>
            <p class="dba-meta mt__lead">{{ 'orgMkt.addonsLead' | translate }}</p>
          </header>
          @if (addons().length === 0) {
            <p class="dba-body mt__muted">{{ 'orgMkt.noAddons' | translate }}</p>
          } @else {
            <dba-data-table
              [columns]="addonColumns"
              [label]="'orgMkt.addons' | translate"
              minWidth="800px"
            >
              @for (addon of addons(); track addon.addonCode) {
                <div class="dba-tr">
                  <span class="dba-td cell">
                    <span class="cell__name">{{ addon.name }}</span>
                    <span class="cell__code">{{ addon.code }}</span>
                  </span>
                  <span class="dba-td cell">
                    <dba-org-state
                      [state]="family(addon)"
                      [labelKey]="stateKey(addon)"
                      variant="inline"
                    />
                    @if (!addon.onSale) {
                      <span class="dba-meta">{{ 'orgMkt.offSale' | translate }}</span>
                    }
                  </span>
                  <span class="dba-td mt__small">{{
                    (addon.source ? 'orgMkt.source.' + addon.source : 'orgMkt.source.none')
                      | translate
                  }}</span>
                  <span class="dba-td dba-td--end dba-mono mt__small">{{
                    amount(addon.unitPrice, currency())
                  }}</span>
                  <span class="dba-td dba-mono mt__small">{{ when(addon.currentPeriodEnd) }}</span>
                  <span class="dba-td dba-td--end">
                    @if (canManage() && actionsOf(addon).length > 0) {
                      <button
                        type="button"
                        class="mt__more"
                        [attr.aria-label]="'orgMkt.actionsFor' | translate: { name: addon.name }"
                        (click)="openAddon(addon, $event, addonMenu)"
                      >
                        <db-icon name="moreVertical" [size]="16" />
                      </button>
                    }
                  </span>
                </div>
              }
            </dba-data-table>
            <p class="dba-meta mt__lead">{{ 'orgMkt.stripeNote' | translate }}</p>
          }
        </section>
      </div>

      <dba-action-menu
        #priceMenu
        label="orgMkt.prices"
        [items]="menuItems()"
        (picked)="pickPrice($event)"
      />
      <dba-action-menu
        #addonMenu
        label="orgMkt.addons"
        [items]="menuItems()"
        (picked)="pickAddon($event)"
      />

      @if (editing(); as price) {
        <dba-override-form
          [price]="price"
          [busy]="working()"
          (submitted)="saveOverride(price, $event)"
          (dismissed)="editing.set(null)"
        />
      }
    }
  `,
  styles: `
    .mt {
      display: flex;
      flex-direction: column;
      gap: var(--dba-grid-gap);
    }

    .mt__card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .mt__head {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .mt__lead,
    .mt__muted {
      margin: 0;
    }

    .mt__muted {
      color: var(--dba-text-muted);
    }

    .mt__small {
      font-size: var(--dba-text-cell);
      color: var(--dba-text);
    }

    .mt__special {
      color: var(--dba-violet-600);
      font-weight: 600;
    }

    .mt__clip {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .cell--end {
      align-items: flex-end;
    }

    .cell__name {
      overflow: hidden;
      font-size: var(--dba-text-cell);
      font-weight: 500;
      color: var(--dba-ink);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cell__code {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }

    .mt__more {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border: 0;
      border-radius: var(--dba-radius-control);
      background: transparent;
      color: var(--dba-text-muted);
      cursor: pointer;
    }

    .mt__more:hover,
    .mt__more:focus-visible {
      background: var(--dba-surface-hover);
      color: var(--dba-ink);
    }

    .mt__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }
  `,
})
export class OrgMarketplaceTabComponent {
  readonly org = input.required<PlatformOrgDetail>();

  private readonly api = inject(OrgMarketplaceApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();
  private readonly orgId = computed(() => this.org().id);

  protected readonly priceColumns = PRICE_COLUMNS;
  protected readonly addonColumns = ADDON_COLUMNS;
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly working = signal(false);
  protected readonly prices = signal<OrgProductPrice[]>([]);
  protected readonly addons = signal<OrgAddon[]>([]);
  protected readonly target = signal<Target>(null);
  protected readonly editing = signal<OrgProductPrice | null>(null);
  protected readonly canManage = computed(() => this.auth.canManage('commercial'));
  protected readonly currency = computed(() => this.prices()[0]?.currency ?? '');

  protected readonly menuItems = computed<ActionMenuItem[]>(() => {
    const target = this.target();
    if (!target) return [];
    return target.kind === 'price' ? priceActions(target.price) : addonActions(target.addon);
  });

  constructor() {
    effect(() => {
      if (this.orgId()) untracked(() => void this.reload());
    });
  }

  protected family = addonFamily;
  protected stateKey = addonStateKey;
  protected actionsOf = addonActions;

  protected amount(value: number, currency: string): string {
    return currency ? money(value, currency, this.locale) : String(value);
  }

  protected when(value?: string): string {
    return value ? formatDate(value, 'd/MM/y', this.locale) : '—';
  }

  protected tiersOf(price: OrgProductPrice): string {
    if (price.kind === 'ADDON') return this.t('orgMkt.monthly');
    if (price.tiers.length === 0) return this.t('orgMkt.noTiers');
    return price.tiers
      .map((tier) => this.t('orgMkt.tierLine', { from: tier.minQuantity, pct: tier.discountPct }))
      .join(' · ');
  }

  protected openPrice(price: OrgProductPrice, event: Event, menu: ActionMenuComponent): void {
    this.target.set({ kind: 'price', price });
    menu.toggle(event);
  }

  protected openAddon(addon: OrgAddon, event: Event, menu: ActionMenuComponent): void {
    this.target.set({ kind: 'addon', addon });
    menu.toggle(event);
  }

  protected async pickPrice(key: string): Promise<void> {
    const target = this.target();
    if (target?.kind !== 'price') return;
    if (key === 'override') this.editing.set(target.price);
    if (key === 'remove') await this.removeOverride(target.price);
  }

  protected async pickAddon(key: string): Promise<void> {
    const target = this.target();
    if (target?.kind !== 'addon') return;
    const addon = target.addon;
    const answer = await this.dialogs.open({
      intent: key === 'activate' ? 'primary' : 'danger',
      icon: key === 'activate' ? 'market' : 'lock',
      title: `orgMkt.confirm.${key}.title`,
      message: `orgMkt.confirm.${key}.message`,
      params: {
        name: addon.name,
        org: this.org().businessName,
        date: this.when(addon.currentPeriodEnd),
      },
      confirmLabel: `orgMkt.confirm.${key}.button`,
      reason: REASON,
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    const request =
      key === 'cancel'
        ? this.api.cancelAddon(this.orgId(), addon.addonCode, answer.reason)
        : this.api.setAddon(this.orgId(), addon.addonCode, key === 'activate', answer.reason);
    if ((await this.run(request)) !== null) {
      this.notify.success(this.t(`orgMkt.done.${key}`, { name: addon.name }));
      await this.reload();
    }
  }

  protected async saveOverride(price: OrgProductPrice, body: OverrideBody): Promise<void> {
    if ((await this.run(this.api.setPrice(this.orgId(), price.productCode, body))) !== null) {
      this.editing.set(null);
      this.notify.success(this.t('orgMkt.done.override', { name: price.name }));
      await this.reload();
    }
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.error.set(false);
    try {
      const [prices, addons] = await Promise.all([
        firstValueFrom(this.api.prices(this.orgId())),
        firstValueFrom(this.api.addons(this.orgId())),
      ]);
      if (!current()) return;
      this.prices.set(prices);
      this.addons.set(addons);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  private async removeOverride(price: OrgProductPrice): Promise<void> {
    const answer = await this.dialogs.open({
      intent: 'danger',
      icon: 'market',
      title: 'orgMkt.confirm.remove.title',
      message: 'orgMkt.confirm.remove.message',
      params: { name: price.name, general: this.amount(price.generalUnitPrice, price.currency) },
      confirmLabel: 'orgMkt.confirm.remove.button',
      reason: REASON,
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    if (
      (await this.run(this.api.removePrice(this.orgId(), price.productCode, answer.reason))) !==
      null
    ) {
      this.notify.success(this.t('orgMkt.done.remove', { name: price.name }));
      await this.reload();
    }
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }

  private async run(request: Observable<unknown>): Promise<unknown> {
    this.working.set(true);
    try {
      return (await firstValueFrom(request)) ?? true;
    } catch (error) {
      const code = errorCodeOf(error);
      const known = code !== null && ORG_MARKET_ERRORS.includes(code);
      this.notify.error(this.t(known ? `orgMkt.error.${code}` : 'orgMkt.error.generic'));
      return null;
    } finally {
      this.working.set(false);
    }
  }
}

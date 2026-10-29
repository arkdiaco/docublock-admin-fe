import { formatDate, formatNumber } from '@angular/common';
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
import { errorCodeOf } from '../../../../shared/http/error-code';
import { LatestRequest } from '../../../../shared/http/latest-request';
import { saveBlob } from '../../../../shared/http/save-blob';
import {
  ActionMenuComponent,
  type ActionMenuItem,
} from '../../../../shared/ui/action-menu.component';
import { ButtonComponent } from '../../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state.component';
import { ModuleToggleComponent } from '../../../../shared/ui/module-toggle.component';
import { SectionLoaderComponent } from '../../../../shared/ui/section-loader.component';
import { StatBandComponent, type StatCell } from '../../../../shared/ui/stat-band.component';
import type { PlatformOrgDetail } from '../../data/organizations.models';
import { ValidationsApi } from '../../data/validations.api';
import {
  CREDIT_TYPES,
  PRICED_TYPES,
  VALIDATION_KEYS,
  type CreditChange,
  type CreditLogEntry,
  type CreditType,
  type OrgCredits,
  type OrgSettings,
  type PricingBody,
  type ValidationKey,
  type ValidationPricing,
} from '../../data/validations.models';
import { CreditFormComponent } from './credit-form.component';
import { PricingFormComponent } from './pricing-form.component';

const LIMIT = 20;

const LOG_COLUMNS: readonly DataColumn[] = [
  { key: 'date', labelKey: 'val.col.date', width: '150px' },
  { key: 'type', labelKey: 'val.col.type', width: 'minmax(180px, 1.4fr)' },
  { key: 'action', labelKey: 'val.col.action', width: 'minmax(140px, 1fr)' },
  { key: 'amount', labelKey: 'val.col.amount', width: '100px', align: 'end' },
  { key: 'balance', labelKey: 'val.col.balance', width: '140px', align: 'end' },
];

const ABBR: Record<ValidationKey, string> = {
  identityValid: 'VD',
  biometricValid: 'BA',
  ani: 'CR',
  liveness: 'LV',
};

const KNOWN_ERRORS = ['SETTINGS_SIN_CAMBIOS', 'PAQUETE_VACIO'];

type Open = { kind: 'credit'; type: CreditType } | { kind: 'pricing' } | null;

@Component({
  selector: 'dba-validations-tab',
  imports: [
    TranslatePipe,
    ActionMenuComponent,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    ModuleToggleComponent,
    SectionLoaderComponent,
    StatBandComponent,
    CreditFormComponent,
    PricingFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'val.loading' | translate" />
    } @else if (error()) {
      <div class="vt__panel">
        <dba-empty-state titleKey="val.errorTitle" leadKey="val.errorLead" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else {
      <div class="vt">
        <section class="vt__card">
          <header class="vt__head">
            <h2 class="dba-panel">{{ 'val.enabled' | translate }}</h2>
            <p class="dba-meta vt__lead">{{ 'val.enabledLead' | translate }}</p>
          </header>
          <div class="vt__toggles">
            @for (key of validationKeys; track key) {
              <dba-module-toggle
                [abbr]="abbr[key]"
                [name]="'val.validation.' + key | translate"
                [meta]="'val.validationHint.' + key | translate"
                [on]="settings()!.validations[key]"
                [disabled]="!canManage() || working()"
                (toggled)="toggleValidation(key, $event)"
              />
            }
          </div>
          <p class="dba-meta vt__self">
            {{ 'val.selfService' | translate }} {{ 'val.self.blockComments' | translate }}:
            {{ yesNo(settings()!.selfService.blockComments) }} ·
            {{ 'val.self.documentPhotos' | translate }}:
            {{ yesNo(settings()!.selfService.documentPhotos) }}
          </p>
        </section>

        <section class="vt__card">
          <header class="vt__head vt__head--row">
            <h2 class="dba-panel">{{ 'val.credits' | translate }}</h2>
            @if (canManage()) {
              <button dba-button variant="secondary" (click)="creditMenu.toggle($event)">
                {{ 'val.adjustCredits' | translate }}
              </button>
            }
          </header>
          <db-stat-band [cells]="creditCells()" [label]="'val.credits' | translate" />
        </section>

        <section class="vt__card">
          <header class="vt__head vt__head--row">
            <h2 class="dba-panel">{{ 'val.pricing.section' | translate }}</h2>
            <div class="vt__tools">
              <button
                dba-button
                variant="secondary"
                [busy]="downloading()"
                (click)="downloadBilling()"
              >
                {{ 'val.billing' | translate }}
              </button>
              @if (canManage()) {
                <button dba-button (click)="open.set({ kind: 'pricing' })">
                  {{ 'val.pricing.open' | translate }}
                </button>
              }
            </div>
          </header>
          @if (!pricing()!.configured) {
            <p class="dba-body vt__muted">
              {{ 'val.pricing.notConfigured' | translate: { currency: pricing()!.currency } }}
            </p>
          }
          <dl class="vt__dl">
            <dt>{{ 'val.pricing.mode' | translate }}</dt>
            <dd>{{ 'val.pricing.modes.' + pricing()!.mode | translate }}</dd>
            @if (pricing()!.mode === 'package') {
              <dt>{{ 'val.pricing.packagePrice' | translate }}</dt>
              <dd class="dba-mono">{{ money(pricing()!.packagePrice) }}</dd>
              <dt>{{ 'val.pricing.includes' | translate }}</dt>
              <dd>{{ includesLabel() }}</dd>
            } @else {
              @for (type of pricedTypes; track type) {
                <dt>{{ 'val.priced.' + type | translate }}</dt>
                <dd class="dba-mono">{{ money(pricing()!.unitPrices[type]) }}</dd>
              }
            }
            @if (pricing()!.notes) {
              <dt>{{ 'val.pricing.notes' | translate }}</dt>
              <dd>{{ pricing()!.notes }}</dd>
            }
          </dl>
        </section>

        <section class="vt__card">
          <h2 class="dba-panel">{{ 'val.log' | translate }}</h2>
          @if (log().length === 0) {
            <p class="dba-body vt__muted">{{ 'val.noLog' | translate }}</p>
          } @else {
            <dba-data-table
              [columns]="logColumns"
              [label]="'val.log' | translate"
              minWidth="680px"
              [total]="logTotal()"
              [from]="from()"
              [to]="to()"
              [page]="page()"
              [pageCount]="pageCount()"
              (pageChange)="goPage($event)"
            >
              @for (entry of log(); track entry.id) {
                <div class="dba-tr">
                  <span class="dba-td dba-mono vt__small">{{ when(entry.createdAt) }}</span>
                  <span class="dba-td vt__small">{{
                    'val.creditType.' + entry.creditType | translate
                  }}</span>
                  <span class="dba-td vt__small">{{
                    'val.logAction.' + entry.action | translate
                  }}</span>
                  <span class="dba-td dba-td--end dba-mono vt__small">{{ amountOf(entry) }}</span>
                  <span class="dba-td dba-td--end dba-mono vt__small">{{ balanceOf(entry) }}</span>
                </div>
              }
            </dba-data-table>
          }
        </section>
      </div>

      <dba-action-menu
        #creditMenu
        label="val.adjustCredits"
        [items]="creditItems"
        (picked)="pickCredit($event)"
      />

      @switch (open()?.kind) {
        @case ('credit') {
          <dba-credit-form
            [type]="creditType()!"
            [balance]="credits()![creditType()!]"
            [modeLabels]="creditModeLabels()"
            [busy]="working()"
            (submitted)="updateCredit($event)"
            (dismissed)="open.set(null)"
          />
        }
        @case ('pricing') {
          <dba-pricing-form
            [pricing]="pricing()!"
            [orgName]="org().businessName"
            [modeLabels]="pricingModeLabels()"
            [busy]="working()"
            (submitted)="savePricing($event)"
            (dismissed)="open.set(null)"
          />
        }
      }
    }
  `,
  styles: `
    .vt {
      display: flex;
      flex-direction: column;
      gap: var(--dba-grid-gap);
    }

    .vt__card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .vt__head {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .vt__head--row {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .vt__lead {
      margin: 0;
    }

    .vt__tools {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .vt__toggles {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1px;
      overflow: hidden;
      border: 1px solid var(--dba-border-row);
      border-radius: var(--dba-radius-control);
      background: var(--dba-border-row);
    }

    .vt__self {
      margin: 0;
    }

    .vt__muted {
      margin: 0;
      color: var(--dba-text-muted);
    }

    .vt__dl {
      display: grid;
      grid-template-columns: 200px minmax(0, 1fr);
      gap: 8px 16px;
      margin: 0;
      font-size: var(--dba-text-cell);
    }

    .vt__dl dt {
      color: var(--dba-text-muted);
    }

    .vt__dl dd {
      margin: 0;
      color: var(--dba-ink);
    }

    .vt__small {
      overflow: hidden;
      font-size: var(--dba-text-cell);
      color: var(--dba-text);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .vt__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    @media (max-width: 720px) {
      .vt__toggles,
      .vt__dl {
        grid-template-columns: minmax(0, 1fr);
      }

      .vt__dl dd {
        margin-bottom: 6px;
      }
    }
  `,
})
export class ValidationsTabComponent {
  readonly org = input.required<PlatformOrgDetail>();

  private readonly api = inject(ValidationsApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();
  private readonly orgId = computed(() => this.org().id);

  protected readonly validationKeys = VALIDATION_KEYS;
  protected readonly creditItems: ActionMenuItem[] = CREDIT_TYPES.map((key) => ({
    key,
    labelKey: 'val.creditType.' + key,
  }));
  protected readonly pricedTypes = PRICED_TYPES;
  protected readonly abbr = ABBR;
  protected readonly logColumns = LOG_COLUMNS;
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly working = signal(false);
  protected readonly downloading = signal(false);
  protected readonly settings = signal<OrgSettings | null>(null);
  protected readonly credits = signal<OrgCredits | null>(null);
  protected readonly pricing = signal<ValidationPricing | null>(null);
  protected readonly log = signal<CreditLogEntry[]>([]);
  protected readonly logTotal = signal(0);
  protected readonly page = signal(1);
  protected readonly open = signal<Open>(null);
  protected readonly canManage = computed(() => this.auth.canManage('clients'));

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.logTotal() / LIMIT)));
  protected readonly from = computed(() =>
    this.logTotal() === 0 ? 0 : (this.page() - 1) * LIMIT + 1,
  );
  protected readonly to = computed(() => Math.min(this.logTotal(), this.page() * LIMIT));

  protected readonly creditType = computed(() => {
    const open = this.open();
    return open?.kind === 'credit' ? open.type : null;
  });

  protected readonly creditCells = computed<StatCell[]>(() => {
    const credits = this.credits();
    if (!credits) return [];
    return CREDIT_TYPES.map((type) => {
      const balance = credits[type];
      return {
        key: type,
        label: this.t('val.creditType.' + type),
        value: balance.unlimited
          ? this.t('val.unlimited')
          : formatNumber(balance.remaining, this.locale),
        note: balance.unlimited ? undefined : this.t('val.remaining'),
        tone: !balance.unlimited && balance.remaining === 0 ? 'warn' : 'plain',
      };
    });
  });

  protected readonly includesLabel = computed(
    () =>
      (this.pricing()?.packageIncludes ?? [])
        .map((type) => this.t('val.priced.' + type))
        .join(' · ') || '—',
  );

  protected readonly creditModeLabels = computed(() => ({
    recharge: this.t('val.credit.modes.recharge'),
    set: this.t('val.credit.modes.set'),
  }));

  protected readonly pricingModeLabels = computed(() => ({
    package: this.t('val.pricing.modes.package'),
    per_validation: this.t('val.pricing.modes.per_validation'),
  }));

  constructor() {
    effect(() => {
      if (this.orgId()) untracked(() => void this.reload());
    });
  }

  protected yesNo(value: boolean): string {
    return this.t(value ? 'val.yes' : 'val.no');
  }

  protected money(value: number): string {
    return `${formatNumber(value, this.locale, '1.0-2')} ${this.pricing()?.currency ?? ''}`.trim();
  }

  protected when(value?: string): string {
    return value ? formatDate(value, 'd/MM/y HH:mm', this.locale) : '—';
  }

  protected amountOf(entry: CreditLogEntry): string {
    if (entry.action === 'set_unlimited') return '—';
    const sign = entry.action === 'consume' ? '−' : entry.action === 'recharge' ? '+' : '';
    return `${sign}${formatNumber(Math.abs(entry.amount), this.locale)}`;
  }

  protected balanceOf(entry: CreditLogEntry): string {
    if (entry.unlimited) return this.t('val.unlimited');
    return entry.newRemaining === undefined ? '—' : formatNumber(entry.newRemaining, this.locale);
  }

  protected pickCredit(key: string): void {
    const type = CREDIT_TYPES.find((item) => item === key);
    if (type) this.open.set({ kind: 'credit', type });
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.loadLog();
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(this.settings() === null);
    this.error.set(false);
    try {
      const [settings, credits, pricing, log] = await Promise.all([
        firstValueFrom(this.api.settings(this.orgId())),
        firstValueFrom(this.api.credits(this.orgId())),
        firstValueFrom(this.api.pricing(this.orgId())),
        firstValueFrom(this.api.log(this.orgId(), this.page(), LIMIT)),
      ]);
      if (!current()) return;
      this.settings.set(settings);
      this.credits.set(credits);
      this.pricing.set(pricing);
      this.log.set(log.items);
      this.logTotal.set(log.total);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  protected async toggleValidation(key: ValidationKey, value: boolean): Promise<void> {
    const name = this.t('val.validation.' + key);
    const answer = await this.dialogs.open({
      intent: value ? 'primary' : 'danger',
      icon: value ? 'shieldCheck' : 'lock',
      title: value ? 'val.enableTitle' : 'val.disableTitle',
      message: value ? 'val.enableMessage' : 'val.disableMessage',
      params: { name },
      confirmLabel: value ? 'val.enable' : 'val.disable',
      reason: {
        labelKey: 'sub.reasonLabel',
        placeholder: 'sub.reasonPlaceholder',
        limit: 500,
        quick: [],
        required: true,
      },
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    const settings = await this.run(
      this.api.setValidation(this.orgId(), key, value, answer.reason),
    );
    if (settings) {
      this.settings.set(settings as OrgSettings);
      this.done(value ? 'val.done.enable' : 'val.done.disable', { name });
    }
  }

  protected async updateCredit(event: { change: CreditChange; reason: string }): Promise<void> {
    const type = this.creditType();
    if (!type) return;
    const credits = await this.run(
      this.api.updateCredit(this.orgId(), type, event.change, event.reason),
    );
    if (credits) {
      this.credits.set(credits as OrgCredits);
      this.open.set(null);
      this.done('val.done.credit', { type: this.t('val.creditType.' + type) });
      await this.loadLog();
    }
  }

  protected async savePricing(body: PricingBody): Promise<void> {
    const pricing = await this.run(this.api.setPricing(this.orgId(), body));
    if (pricing) {
      this.pricing.set(pricing as ValidationPricing);
      this.open.set(null);
      this.done('val.done.pricing');
    }
  }

  protected async downloadBilling(): Promise<void> {
    const now = new Date();
    const from = formatDate(new Date(now.getFullYear(), now.getMonth(), 1), 'y-MM-dd', 'en');
    const to = formatDate(now, 'y-MM-dd', 'en');
    this.downloading.set(true);
    try {
      const file = await firstValueFrom(this.api.billingPdf(this.orgId(), from, to));
      saveBlob(file.blob, file.filename);
    } catch {
      this.notify.error(this.t('val.error.billing'));
    } finally {
      this.downloading.set(false);
    }
  }

  private async loadLog(): Promise<void> {
    try {
      const log = await firstValueFrom(this.api.log(this.orgId(), this.page(), LIMIT));
      this.log.set(log.items);
      this.logTotal.set(log.total);
    } catch {
      return;
    }
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }

  private done(key: string, params?: Record<string, unknown>): void {
    this.notify.success(this.t(key, params));
  }

  private async run(request: Observable<unknown>): Promise<unknown> {
    this.working.set(true);
    try {
      return await firstValueFrom(request);
    } catch (error) {
      const code = errorCodeOf(error);
      const known = code !== null && KNOWN_ERRORS.includes(code);
      this.notify.error(this.t(known ? `val.error.${code}` : 'val.error.generic'));
      return null;
    } finally {
      this.working.set(false);
    }
  }
}

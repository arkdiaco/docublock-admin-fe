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
import { AuthStore } from '../../../core/auth/auth.store';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { money } from '../../../shared/domain/money';
import { errorCodeOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ActionMenuComponent, type ActionMenuItem } from '../../../shared/ui/action-menu.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { RecordHeaderComponent } from '../../../shared/ui/record-header.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { ProductFormComponent } from '../components/product-form.component';
import { ProductTextsFormComponent } from '../components/product-texts-form.component';
import { MarketplaceApi } from '../data/marketplace.api';
import {
  STORE_ADDON_CHANGES,
  STORE_DETAIL_CODES,
  type ProductDetail,
  type ProductTexts,
  type VersionProductBody,
} from '../data/marketplace.models';
import { kindLabel, priceText, tiersText } from '../data/product-format';

const ACTION_ERRORS = [
  'PRODUCTO_SIN_CAMBIOS',
  'PRODUCTO_RETIRADO',
  'PRODUCTO_EN_CAMBIO',
  'PRODUCTO_DATOS_INVALIDOS',
  'PRODUCTO_ACTIVO',
  'ADDON_YA_EN_VENTA',
];

const VERSION_COLUMNS: readonly DataColumn[] = [
  { key: 'version', labelKey: 'mkt.col.version', width: '90px' },
  { key: 'date', labelKey: 'mkt.col.date', width: '120px' },
  { key: 'state', labelKey: 'mkt.col.state', width: '130px' },
  { key: 'price', labelKey: 'mkt.col.unitPrice', width: '140px' },
  { key: 'tiers', labelKey: 'mkt.col.tiers', width: 'minmax(0, 1fr)' },
  { key: 'tax', labelKey: 'mkt.col.tax', width: '70px', align: 'end' },
];

const reasonField = {
  labelKey: 'mkt.f.reason',
  placeholder: 'mkt.form.reasonPlaceholder',
  limit: 500,
  quick: [],
  required: true,
};

@Component({
  selector: 'dba-product-detail',
  imports: [
    TranslatePipe,
    RecordHeaderComponent,
    OrgStateComponent,
    ButtonComponent,
    ActionMenuComponent,
    DataTableComponent,
    EmptyStateComponent,
    SectionLoaderComponent,
    ProductFormComponent,
    ProductTextsFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'mkt.detailLoading' | translate" />
    } @else if (error()) {
      <div class="pd__panel">
        <dba-empty-state
          [titleKey]="error() === 'PRODUCTO_NO_ENCONTRADO' ? 'mkt.notFound' : 'mkt.errorTitle'"
        />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (product(); as data) {
      <div class="pd">
        <dba-record-header
          [initials]="data.kind === 'ADDON' ? 'AD' : 'V' + (data.level ?? '')"
          [title]="data.name"
          [state]="data.state === 'ACTIVE' ? 'active' : 'closed'"
          [stateLabelKey]="'mkt.state.' + data.state"
          [meta]="meta()"
        >
          @if (canManage()) {
            <div actions class="pd__actions">
              @if (data.state === 'ACTIVE') {
                <button dba-button (click)="versioning.set(true)">
                  {{ 'mkt.newVersion' | translate }}
                </button>
              }
              <button
                dba-button
                variant="secondary"
                [busy]="working()"
                (click)="menu.toggle($event)"
              >
                {{ 'mkt.more' | translate }}
              </button>
              <dba-action-menu
                #menu
                label="mkt.more"
                [items]="menuItems()"
                (picked)="pick($event)"
              />
            </div>
          }
        </dba-record-header>

        <div class="pd__cols">
          <section class="pd__card">
            <h2 class="dba-panel">{{ 'mkt.terms' | translate }}</h2>
            <dl class="pd__dl">
              <dt>{{ 'mkt.f.kind' | translate }}</dt>
              <dd>{{ 'mkt.kind.' + data.kind | translate }} · {{ kindText() | translate }}</dd>
              <dt>{{ 'mkt.col.price' | translate }}</dt>
              <dd>{{ price() }}</dd>
              <dt>{{ 'mkt.f.taxPct' | translate }}</dt>
              <dd class="dba-mono">{{ data.taxPct }} %</dd>
              @if (data.kind === 'VALIDATION_PACKAGE') {
                <dt>{{ 'mkt.f.minQuantity' | translate }}</dt>
                <dd class="dba-mono">{{ data.minQuantity }}</dd>
                <dt>{{ 'mkt.f.tiers' | translate }}</dt>
                <dd>{{ tiers() }}</dd>
              }
              <dt>{{ 'mkt.f.currency' | translate }}</dt>
              <dd class="dba-mono">{{ data.currency }}</dd>
              <dt>{{ 'mkt.f.visible' | translate }}</dt>
              <dd>{{ (data.visible ? 'mkt.visibleYes' : 'mkt.visibleNo') | translate }}</dd>
            </dl>
          </section>

          <section class="pd__card">
            <header class="pd__head">
              <h2 class="dba-panel">{{ 'mkt.storeCopy' | translate }}</h2>
              @if (canManage() && data.state === 'ACTIVE') {
                <button dba-button variant="secondary" (click)="editingTexts.set(true)">
                  {{ 'mkt.texts.open' | translate }}
                </button>
              }
            </header>
            <div class="copy">
              <p class="copy__name">{{ data.name }}</p>
              <p class="copy__summary">{{ data.summary || '—' }}</p>
              @if (data.bullets.length > 0) {
                <ul class="copy__bullets">
                  @for (bullet of data.bullets; track $index) {
                    <li>{{ bullet }}</li>
                  }
                </ul>
              }
              @if (data.limitations) {
                <p class="dba-meta">{{ data.limitations }}</p>
              }
            </div>
            @if (missingStoreCopy()) {
              <p class="dba-meta pd__warn">{{ missingStoreCopy()! | translate }}</p>
            }
          </section>

          <section class="pd__card">
            <h2 class="dba-panel">{{ 'mkt.usageTitle' | translate }}</h2>
            <dl class="pd__dl">
              @if (data.kind === 'ADDON') {
                <dt>{{ 'mkt.activeAddons' | translate }}</dt>
                <dd class="dba-mono">{{ data.activeAddons }}</dd>
              } @else {
                <dt>{{ 'mkt.paidOrders' | translate }}</dt>
                <dd class="dba-mono">{{ data.paidOrders30d }}</dd>
              }
              <dt>{{ 'mkt.overrides' | translate }}</dt>
              <dd class="dba-mono">{{ data.overrides }}</dd>
            </dl>
            <p class="dba-meta">{{ 'mkt.usageHint' | translate }}</p>
          </section>
        </div>

        <section class="pd__card">
          <h2 class="dba-panel">{{ 'mkt.history' | translate: { total: data.history.length } }}</h2>
          <dba-data-table
            [columns]="versionColumns"
            [label]="'mkt.historyLabel' | translate"
            minWidth="760px"
          >
            @for (version of data.history; track version.id) {
              <div class="dba-tr">
                <code class="dba-td">v{{ version.version }}</code>
                <span class="dba-td dba-mono">{{ day(version.createdAt) }}</span>
                <span class="dba-td">
                  <dba-org-state
                    [state]="version.state === 'ACTIVE' ? 'active' : 'closed'"
                    [labelKey]="'mkt.state.' + version.state"
                    variant="inline"
                  />
                </span>
                <code class="dba-td">{{ amount(version.unitPrice) }}</code>
                <span class="dba-td dba-meta">{{ tiersOf(version.tiers) }}</span>
                <code class="dba-td dba-td--end">{{ version.taxPct }} %</code>
              </div>
            }
          </dba-data-table>
        </section>
      </div>

      @if (versioning()) {
        <dba-product-form
          [product]="data"
          [busy]="working()"
          (versioned)="version($event)"
          (dismissed)="versioning.set(false)"
        />
      }

      @if (editingTexts()) {
        <dba-product-texts-form
          [product]="data"
          [busy]="working()"
          (submitted)="saveTexts($event)"
          (dismissed)="editingTexts.set(false)"
        />
      }
    }
  `,
  styles: `
    .pd {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .pd__actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .pd__cols {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--dba-grid-gap);
      align-items: start;
    }

    .pd__card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .pd__card h2,
    .pd__card p {
      margin: 0;
    }

    .pd__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .pd__dl {
      display: grid;
      grid-template-columns: 170px minmax(0, 1fr);
      gap: 10px 16px;
      margin: 0;
    }

    .pd__dl dt {
      font-size: var(--dba-text-label);
      color: var(--dba-text-muted);
    }

    .pd__dl dd {
      margin: 0;
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
      overflow-wrap: anywhere;
    }

    .pd__warn {
      color: var(--dba-state-suspended-fg);
    }

    .copy {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .copy__name {
      font-size: var(--dba-text-body);
      font-weight: 600;
      color: var(--dba-ink);
    }

    .copy__summary {
      font-size: var(--dba-text-cell);
      color: var(--dba-text);
    }

    .copy__bullets {
      margin: 0;
      padding-left: 18px;
      font-size: var(--dba-text-cell);
      color: var(--dba-text);
    }

    .pd__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 24px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    @media (max-width: 860px) {
      .pd__cols {
        grid-template-columns: minmax(0, 1fr);
      }

      .pd__dl {
        grid-template-columns: minmax(0, 1fr);
        gap: 2px;
      }

      .pd__dl dd {
        margin-bottom: 8px;
      }
    }
  `,
})
export class ProductDetailComponent {
  readonly code = input.required<string>();

  private readonly api = inject(MarketplaceApi);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly notify = inject(NotificationService);
  private readonly dialogs = inject(DialogService);
  private readonly auth = inject(AuthStore);
  private readonly latest = new LatestRequest();

  protected readonly versionColumns = VERSION_COLUMNS;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly product = signal<ProductDetail | null>(null);
  protected readonly versioning = signal(false);
  protected readonly editingTexts = signal(false);
  protected readonly working = signal(false);
  protected readonly canManage = computed(() => this.auth.canManage('commercial'));

  protected readonly kindText = computed(() => {
    const product = this.product();
    return product ? kindLabel(product) : '';
  });

  protected readonly meta = computed(() => {
    const product = this.product();
    if (!product) return '';
    return [`${product.code} · v${product.version}`, product.currency].join(' · ');
  });

  protected readonly price = computed(() => {
    const product = this.product();
    return product ? priceText(product, this.translate, this.locale) : '';
  });

  protected readonly tiers = computed(() => this.tiersOf(this.product()?.tiers ?? []));

  protected readonly missingStoreCopy = computed<string | null>(() => {
    const product = this.product();
    if (!product) return null;
    if (product.kind === 'ADDON') {
      return product.addonCode && STORE_ADDON_CHANGES.includes(product.addonCode)
        ? null
        : 'mkt.storeAddonMissing';
    }
    return STORE_DETAIL_CODES.includes(product.code) ? null : 'mkt.storeDetailMissing';
  });

  protected readonly menuItems = computed<ActionMenuItem[]>(() => {
    const product = this.product();
    if (!product) return [];
    if (product.state === 'RETIRED') return [{ key: 'reactivate', labelKey: 'mkt.reactivate' }];
    return [
      product.visible
        ? { key: 'hide', labelKey: 'mkt.hide' }
        : { key: 'show', labelKey: 'mkt.show' },
      { key: 'retire', labelKey: 'mkt.retire', danger: true, separated: true },
    ];
  });

  constructor() {
    effect(() => {
      const code = this.code();
      untracked(() => void this.load(code));
    });
  }

  protected reload(): void {
    void this.load(this.code());
  }

  protected tiersOf(tiers: ProductDetail['tiers']): string {
    return tiersText(tiers, this.translate);
  }

  protected amount(value: number): string {
    const product = this.product();
    return product ? money(value, product.currency, this.locale) : '';
  }

  protected day(value?: string): string {
    return value ? formatDate(value, 'd/MM/y', this.locale) : '—';
  }

  protected pick(key: string): void {
    const product = this.product();
    if (!product) return;
    if (key === 'hide' || key === 'show') void this.toggleVisible(product, key === 'show');
    else if (key === 'retire') void this.retire(product);
    else if (key === 'reactivate') void this.reactivate(product);
  }

  protected async version(body: VersionProductBody): Promise<void> {
    const product = this.product();
    if (!product) return;
    if (await this.run(this.api.version(product.code, body), 'mkt.done.versioned'))
      this.versioning.set(false);
  }

  protected async saveTexts(change: { texts: ProductTexts; reason: string }): Promise<void> {
    const product = this.product();
    if (!product) return;
    if (
      await this.run(this.api.setTexts(product.code, change.texts, change.reason), 'mkt.done.texts')
    ) {
      this.editingTexts.set(false);
    }
  }

  private async toggleVisible(product: ProductDetail, visible: boolean): Promise<void> {
    const answer = await this.dialogs.open({
      intent: 'primary',
      icon: 'eye',
      title: visible ? 'mkt.showTitle' : 'mkt.hideTitle',
      message: visible ? 'mkt.showMessage' : 'mkt.hideMessage',
      params: { name: product.name },
      confirmLabel: visible ? 'mkt.show' : 'mkt.hide',
      reason: reasonField,
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    await this.run(
      this.api.setVisible(product.code, visible, answer.reason),
      visible ? 'mkt.done.shown' : 'mkt.done.hidden',
    );
  }

  private async retire(product: ProductDetail): Promise<void> {
    const answer = await this.dialogs.open({
      intent: 'danger',
      icon: 'triangleAlert',
      title: 'mkt.retireTitle',
      message: product.kind === 'ADDON' ? 'mkt.retireAddonMessage' : 'mkt.retireMessage',
      params: { name: product.name, total: product.activeAddons },
      confirmLabel: 'mkt.retire',
      reason: reasonField,
      challenge: { identifier: product.code, actionKey: 'mkt.retireVerb' },
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    await this.run(this.api.retire(product.code, answer.reason), 'mkt.done.retired');
  }

  private async reactivate(product: ProductDetail): Promise<void> {
    const answer = await this.dialogs.open({
      intent: 'primary',
      icon: 'circleCheck',
      title: 'mkt.reactivateTitle',
      message: 'mkt.reactivateMessage',
      params: { name: product.name },
      confirmLabel: 'mkt.reactivate',
      reason: reasonField,
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    await this.run(this.api.reactivate(product.code, answer.reason), 'mkt.done.reactivated');
  }

  private async run(
    request: Observable<ProductDetail>,
    doneKey: string,
  ): Promise<ProductDetail | null> {
    this.working.set(true);
    try {
      const updated = await firstValueFrom(request);
      this.product.set(updated);
      this.notify.success(this.translate.instant(doneKey) as string);
      return updated;
    } catch (failure) {
      const code = errorCodeOf(failure);
      this.notify.error(
        this.translate.instant(
          code && ACTION_ERRORS.includes(code) ? `mkt.error.${code}` : 'mkt.error.generic',
        ) as string,
      );
      return null;
    } finally {
      this.working.set(false);
    }
  }

  private async load(code: string): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(null);
    try {
      const detail = await firstValueFrom(this.api.detail(code));
      if (current()) this.product.set(detail);
    } catch (failure) {
      if (!current()) return;
      this.product.set(null);
      this.error.set(errorCodeOf(failure) ?? 'generic');
    } finally {
      if (current()) this.loading.set(false);
    }
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { NotificationService } from '../../../core/ui/notification.service';
import { errorCodeOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FilterPillsComponent, type FilterPill } from '../../../shared/ui/filter-pills.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { ProductFormComponent } from '../components/product-form.component';
import { MarketplaceApi } from '../data/marketplace.api';
import type {
  CreateProductBody,
  ProductKind,
  ProductListState,
  ProductRow,
} from '../data/marketplace.models';
import { kindLabel, priceText } from '../data/product-format';

const DEBOUNCE_MS = 350;
const ALL = '';

const COLUMNS: readonly DataColumn[] = [
  { key: 'product', labelKey: 'mkt.col.product', width: 'minmax(0, 1.6fr)' },
  { key: 'kind', labelKey: 'mkt.col.kind', width: '190px' },
  { key: 'currency', labelKey: 'mkt.col.currency', width: '80px' },
  { key: 'price', labelKey: 'mkt.col.price', width: '230px' },
  { key: 'tax', labelKey: 'mkt.col.tax', width: '70px', align: 'end' },
  { key: 'usage', labelKey: 'mkt.col.usage', width: '190px' },
  { key: 'state', labelKey: 'mkt.col.state', width: '130px' },
  { key: 'chevron', width: '40px', align: 'end' },
];

export const CREATE_ERRORS = [
  'PRODUCTO_CODIGO_EN_USO',
  'PRODUCTO_DATOS_INVALIDOS',
  'MONEDA_NO_ADMITIDA',
  'ADDON_YA_EN_VENTA',
];

interface RowView extends ProductRow {
  kindText: string;
  priceView: string;
  usageLines: string[];
}

@Component({
  selector: 'dba-marketplace',
  imports: [
    TranslatePipe,
    ButtonComponent,
    IconComponent,
    DataTableComponent,
    FilterPillsComponent,
    OrgStateComponent,
    EmptyStateComponent,
    SectionLoaderComponent,
    ProductFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mkt">
      <header class="mkt__head">
        <div class="mkt__title">
          <h1 class="dba-page">{{ 'nav.marketplace' | translate }}</h1>
          <span class="dba-meta">{{ 'mkt.count' | translate: { total: rows().length } }}</span>
        </div>
        @if (canManage()) {
          <button dba-button (click)="creating.set(true)">
            <db-icon name="plus" [size]="15" />
            {{ 'mkt.create' | translate }}
          </button>
        }
      </header>

      @if (creating()) {
        <dba-product-form
          [busy]="saving()"
          (created)="create($event)"
          (dismissed)="creating.set(false)"
        />
      }

      <div class="mkt__tools">
        <label class="mkt__search">
          <db-icon name="search" [size]="15" />
          <input
            type="search"
            class="mkt__input"
            autocomplete="off"
            [placeholder]="'mkt.searchPlaceholder' | translate"
            [value]="searchDraft()"
            (input)="onSearch($event)"
          />
        </label>
        <db-filter-pills [pills]="kindPills" [active]="kind()" (activeChange)="pickKind($event)" />
        <db-filter-pills
          [pills]="statePills"
          [active]="state()"
          (activeChange)="pickState($event)"
        />
      </div>

      @if (loading()) {
        <db-section-loader [label]="'mkt.loading' | translate" />
      } @else if (error()) {
        <div class="mkt__panel">
          <dba-empty-state titleKey="mkt.errorTitle" />
          <button dba-button variant="secondary" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (rows().length === 0) {
        <div class="mkt__panel">
          <dba-empty-state titleKey="mkt.emptyTitle" leadKey="mkt.emptyLead" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'nav.marketplace' | translate"
          minWidth="1220px"
        >
          @for (row of rows(); track row.code) {
            <button type="button" class="dba-tr" (click)="open(row)">
              <span class="dba-td cell">
                <span class="cell__name">{{ row.name }}</span>
                <span class="cell__code">{{ row.code }} · v{{ row.version }}</span>
              </span>
              <span class="dba-td cell">
                {{ 'mkt.kind.' + row.kind | translate }}
                <span class="dba-meta">{{ row.kindText | translate }}</span>
              </span>
              <code class="dba-td">{{ row.currency }}</code>
              <span class="dba-td">{{ row.priceView }}</span>
              <code class="dba-td dba-td--end">{{ row.taxPct }} %</code>
              <span class="dba-td cell">
                @for (line of row.usageLines; track line) {
                  <span class="cell__line">{{ line }}</span>
                }
              </span>
              <span class="dba-td cell">
                <dba-org-state
                  [state]="row.state === 'ACTIVE' ? 'active' : 'closed'"
                  [labelKey]="'mkt.state.' + row.state"
                  variant="inline"
                />
                @if (!row.visible) {
                  <span class="dba-meta">{{ 'mkt.hidden' | translate }}</span>
                }
              </span>
              <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
            </button>
          }
        </dba-data-table>
      }
    </section>
  `,
  styles: `
    .mkt {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .mkt__head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .mkt__title {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .mkt__tools {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }

    .mkt__search {
      display: flex;
      align-items: center;
      gap: 9px;
      width: 320px;
      max-width: 100%;
      height: var(--dba-height-search);
      padding: 0 12px;
      border: 1px solid var(--dba-border-control);
      border-radius: var(--dba-radius-control);
      background: var(--dba-surface);
      color: var(--dba-text-muted);
    }

    .mkt__search:focus-within {
      border-color: var(--dba-violet-500);
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .mkt__input {
      flex: 1;
      min-width: 0;
      height: 100%;
      border: 0;
      background: transparent;
      font-family: var(--dba-font-ui);
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
    }

    .mkt__input:focus {
      outline: none;
    }

    .mkt__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .cell__name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--dba-text-cell);
      font-weight: 500;
      color: var(--dba-ink);
    }

    .cell__code {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }

    .cell__line {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--dba-text-cell);
      color: var(--dba-text);
    }
  `,
})
export class MarketplaceComponent {
  private readonly api = inject(MarketplaceApi);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly notify = inject(NotificationService);
  private readonly auth = inject(AuthStore);
  private readonly latest = new LatestRequest();

  protected readonly columns = COLUMNS;
  protected readonly statePills: FilterPill[] = [
    { key: 'active', labelKey: 'mkt.filter.active' },
    { key: 'retired', labelKey: 'mkt.filter.retired' },
    { key: 'all', labelKey: 'mkt.filter.all' },
  ];
  protected readonly kindPills: FilterPill[] = [
    { key: ALL, labelKey: 'mkt.filter.allKinds' },
    { key: 'VALIDATION_PACKAGE', labelKey: 'mkt.filter.validations' },
    { key: 'ADDON', labelKey: 'mkt.filter.addons' },
  ];
  protected readonly canManage = computed(() => this.auth.canManage('commercial'));
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly state = signal<ProductListState>('active');
  protected readonly kind = signal<string>(ALL);
  protected readonly searchDraft = signal('');
  protected readonly creating = signal(false);
  protected readonly saving = signal(false);
  private readonly items = signal<ProductRow[]>([]);
  private search = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly rows = computed<RowView[]>(() =>
    this.items().map((row) => ({
      ...row,
      kindText: kindLabel(row),
      priceView: priceText(row, this.translate, this.locale),
      usageLines: this.usage(row),
    })),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
    void this.reload();
  }

  protected onSearch(event: Event): void {
    this.searchDraft.set((event.target as HTMLInputElement).value);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.search = this.searchDraft().trim();
      void this.reload();
    }, DEBOUNCE_MS);
  }

  protected pickState(key: string): void {
    this.state.set(key as ProductListState);
    void this.reload();
  }

  protected pickKind(key: string): void {
    this.kind.set(key);
    void this.reload();
  }

  protected open(row: ProductRow): void {
    void this.router.navigate([sectionPath('marketplace'), row.code]);
  }

  protected async create(body: CreateProductBody): Promise<void> {
    this.saving.set(true);
    try {
      const created = await firstValueFrom(this.api.create(body));
      this.creating.set(false);
      this.notify.success(
        this.translate.instant('mkt.done.created', { code: created.code }) as string,
      );
      void this.router.navigate([sectionPath('marketplace'), created.code]);
    } catch (failure) {
      const code = errorCodeOf(failure);
      this.notify.error(
        this.translate.instant(
          code && CREATE_ERRORS.includes(code) ? `mkt.error.${code}` : 'mkt.error.generic',
        ) as string,
      );
    } finally {
      this.saving.set(false);
    }
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const rows = await firstValueFrom(
        this.api.list({
          state: this.state(),
          kind: (this.kind() || undefined) as ProductKind | undefined,
          search: this.search || undefined,
        }),
      );
      if (current()) this.items.set(rows);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  private usage(row: ProductRow): string[] {
    const parts =
      row.kind === 'ADDON'
        ? [this.translate.instant('mkt.usage.addons', { total: row.activeAddons }) as string]
        : [this.translate.instant('mkt.usage.orders', { total: row.paidOrders30d }) as string];
    if (row.overrides > 0)
      parts.push(this.translate.instant('mkt.usage.overrides', { total: row.overrides }) as string);
    return parts;
  }
}

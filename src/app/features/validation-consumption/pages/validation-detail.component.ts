import { formatNumber } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { moneyExact } from '../../../shared/domain/money';
import { LatestRequest } from '../../../shared/http/latest-request';
import { saveBlob } from '../../../shared/http/save-blob';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FieldComponent } from '../../../shared/ui/field.component';
import { FilterPillsComponent, type FilterPill } from '../../../shared/ui/filter-pills.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { StatBandComponent, type StatCell } from '../../../shared/ui/stat-band.component';
import { ConsumptionApi } from '../data/consumption.api';
import {
  COUNT_KEYS,
  type ConsumptionBilling,
  type ConsumptionCounts,
  type CountKey,
  type DetailFilters,
  type DetailItem,
  type DetailResult,
  type DetailScope,
  type DetailSigner,
  type ValidationDetail,
} from '../data/consumption.models';
import { rangeInvalid } from '../data/consumption-view';
import {
  MAX_SEARCH,
  backParamsOf,
  browserTimeZone,
  detailFiltersOf,
  detailQueryParamsOf,
  detailRequestOf,
  monthLabelOf,
  monthsOfPage,
  scopeOf,
} from '../data/detail-view';

const PAGE_SIZE = 20;

const SEARCH_DELAY = 350;

const COUNT_COLUMNS: readonly DataColumn[] = [
  { key: 'ani', labelKey: 'vcon.col.ani', width: '64px', align: 'end' },
  { key: 'liveness', labelKey: 'vcon.col.liveness', width: '64px', align: 'end' },
  { key: 'macherFacial', labelKey: 'vcon.col.macherFacial', width: '64px', align: 'end' },
  { key: 'otros', labelKey: 'vcon.col.otros', width: '64px', align: 'end' },
  { key: 'total', labelKey: 'vcon.col.total', width: '72px', align: 'end' },
];

const MONTH_COLUMNS: readonly DataColumn[] = [
  { key: 'month', labelKey: 'vdet.col.month', width: 'minmax(150px, 1.2fr)' },
  { key: 'documents', labelKey: 'vdet.col.documents', width: '110px', align: 'end' },
  { key: 'signers', labelKey: 'vdet.col.signers', width: '100px', align: 'end' },
  ...COUNT_COLUMNS,
  { key: 'value', labelKey: 'vcon.col.value', width: '150px', align: 'end' },
];

const DOCUMENT_COLUMNS: readonly DataColumn[] = [
  { key: 'toggle', width: '32px' },
  { key: 'document', labelKey: 'vdet.col.document', width: 'minmax(0, 1.6fr)' },
  { key: 'signers', labelKey: 'vdet.col.signers', width: '100px', align: 'end' },
  ...COUNT_COLUMNS,
];

const RESELLER_DOCUMENT_COLUMNS: readonly DataColumn[] = [
  ...DOCUMENT_COLUMNS.slice(0, 2),
  { key: 'organization', labelKey: 'vdet.col.organization', width: 'minmax(0, 1fr)' },
  ...DOCUMENT_COLUMNS.slice(2),
];

const RESULT_STATES: Record<DetailResult, string> = {
  passed: 'active',
  failed: 'suspended',
  retry: 'warning',
  unknown: 'closed',
};

type LoadState = 'loading' | 'ready' | 'failed' | 'notFound';

@Component({
  selector: 'dba-validation-detail',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    FieldComponent,
    FilterPillsComponent,
    IconComponent,
    OrgStateComponent,
    SectionLoaderComponent,
    StatBandComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <a class="vd__back" [routerLink]="listPath" [queryParams]="backParams()">
        <db-icon name="chevronLeft" [size]="14" />
        {{ 'vdet.back' | translate }}
      </a>

      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">
            {{ detail()?.entity?.businessName ?? ('nav.validationConsumption' | translate) }}
          </h1>
          <span class="dba-meta">
            {{ 'vdet.scope.' + (scope() ?? 'organization') | translate }}
            @if (detail()?.billedVia; as via) {
              · {{ 'vdet.billedVia' | translate }}
              @if (canOpenReseller()) {
                <a class="dba-ref" [routerLink]="[resellersPath, via.id]">{{ via.businessName }}</a>
              } @else {
                {{ via.businessName }}
              }
            }
          </span>
        </div>
        <div class="vd__exports">
          <button dba-button variant="secondary" [disabled]="!canExport()" (click)="downloadCsv()">
            <db-icon name="download" [size]="15" />
            {{ 'vdet.csv' | translate }}
          </button>
          <button dba-button variant="secondary" [disabled]="!canExport()" (click)="downloadPdf()">
            <db-icon name="download" [size]="15" />
            {{ 'vdet.pdf' | translate }}
          </button>
        </div>
      </header>

      <div class="bl__tools">
        <dba-field
          class="bl__date"
          label="vcon.from"
          type="date"
          [value]="filters().from ?? ''"
          (valueChange)="apply({ from: $event || null })"
        />
        <dba-field
          class="bl__date"
          label="vcon.to"
          type="date"
          [error]="invalid() ? 'vcon.rangeInvalid' : ''"
          [value]="filters().to ?? ''"
          (valueChange)="apply({ to: $event || null })"
        />
        <label class="bl__search vd__search">
          <db-icon name="search" [size]="15" />
          <input
            type="search"
            class="bl__input"
            autocomplete="off"
            [attr.maxlength]="maxSearch"
            [attr.aria-label]="'vdet.searchLabel' | translate"
            [placeholder]="'vdet.searchPlaceholder' | translate"
            [value]="filters().search"
            (input)="onSearch($event)"
          />
        </label>
        <db-filter-pills
          [pills]="typePills()"
          [active]="filters().type"
          [label]="'vdet.typeLabel' | translate"
          (activeChange)="apply({ type: $any($event) })"
        />
      </div>

      @if (!scope()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="vdet.notFoundTitle" leadKey="vdet.notFoundLead" />
        </div>
      } @else if (invalid()) {
        <p class="dba-meta vd__note">{{ 'vcon.rangeInvalid' | translate }}</p>
      } @else if (state() === 'loading') {
        <db-section-loader [label]="'vdet.loading' | translate" />
      } @else if (state() === 'notFound') {
        <div class="bl__panel">
          <dba-empty-state titleKey="vdet.notFoundTitle" leadKey="vdet.notFoundLead" />
        </div>
      } @else if (state() === 'failed') {
        <div class="bl__panel">
          <dba-empty-state titleKey="vdet.errorTitle" leadKey="vdet.errorLead" />
          <button dba-button variant="secondary" (click)="load()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (detail(); as data) {
        <db-stat-band [cells]="cells()" [label]="'vcon.statsLabel' | translate" />
        @if (!data.pricing?.configured) {
          <p class="dba-meta vd__note">{{ 'vdet.noPricing' | translate }}</p>
        }
        @if (data.capped) {
          <p class="dba-meta vd__note vd__note--warn">{{ 'vdet.capped' | translate }}</p>
        }

        @if (data.months.length === 0) {
          <div class="bl__panel">
            <dba-empty-state titleKey="vdet.emptyTitle" leadKey="vdet.emptyLead" />
          </div>
        } @else {
          <h2 class="dba-section vd__title">{{ 'vdet.months' | translate }}</h2>
          <dba-data-table
            [columns]="monthColumns"
            [label]="'vdet.monthsLabel' | translate"
            [dense]="density.compact()"
            minWidth="860px"
          >
            @for (month of data.months; track month.month) {
              <div class="dba-tr">
                <span class="dba-td cell"
                  ><span class="cell__label">{{ monthLabel(month.month) }}</span></span
                >
                <span class="dba-td dba-td--end vd__num">{{ count(month.documents) }}</span>
                <span class="dba-td dba-td--end vd__num">{{ count(month.signers) }}</span>
                @for (key of countKeys; track key) {
                  <span class="dba-td dba-td--end vd__num">{{ count(month.counts[key]) }}</span>
                }
                <span class="dba-td dba-td--end vd__num vd__strong">{{
                  count(month.counts.total)
                }}</span>
                <span class="dba-td dba-td--end">
                  @if (month.billing) {
                    <span class="cell__amount">{{ money(month.billing) }}</span>
                  } @else {
                    <span class="cell__muted">{{ 'vcon.noPricing' | translate }}</span>
                  }
                </span>
              </div>
            }
          </dba-data-table>

          <h2 class="dba-section vd__title">{{ 'vdet.documents' | translate }}</h2>
          <p class="dba-meta vd__note">{{ 'vdet.copyNote' | translate }}</p>
          @for (group of pageMonths(); track group.month) {
            <h3 class="vd__month">{{ monthLabel(group.month) }}</h3>
            <dba-data-table
              [columns]="documentColumns()"
              [label]="'vdet.documentsLabel' | translate: { month: monthLabel(group.month) }"
              [dense]="density.compact()"
              minWidth="820px"
            >
              @for (item of group.items; track item.month + item.document.id) {
                <div class="dba-tr" [class.dba-tr--on]="isOpen(item)">
                  <span class="dba-td">
                    <button
                      type="button"
                      class="vd__toggle"
                      [class.vd__toggle--open]="isOpen(item)"
                      [attr.aria-expanded]="isOpen(item)"
                      [attr.aria-label]="'vdet.expand' | translate: { name: item.document.name }"
                      (click)="toggle(item)"
                    >
                      <db-icon name="chevronDown" [size]="15" />
                    </button>
                  </span>
                  <span class="dba-td cell">
                    @if (canOpenDocument()) {
                      <a
                        class="dba-ref cell__label"
                        [routerLink]="[documentsPath, item.document.id]"
                        >{{ item.document.name }}</a
                      >
                    } @else {
                      <span class="cell__label">{{ item.document.name }}</span>
                    }
                    <span class="cell__meta">{{
                      item.document.code ?? ('vdet.noCode' | translate)
                    }}</span>
                  </span>
                  @if (data.scope === 'reseller') {
                    <span class="dba-td cell">
                      @if (canOpenOrganization()) {
                        <a
                          class="dba-ref cell__text"
                          [routerLink]="[organizationsPath, item.organization.id]"
                          >{{ item.organization.name }}</a
                        >
                      } @else {
                        <span class="cell__text">{{ item.organization.name }}</span>
                      }
                    </span>
                  }
                  <span class="dba-td dba-td--end vd__num">{{ count(item.signers.length) }}</span>
                  @for (key of countKeys; track key) {
                    <span class="dba-td dba-td--end vd__num">{{ count(item.counts[key]) }}</span>
                  }
                  <span class="dba-td dba-td--end vd__num vd__strong">{{
                    count(item.counts.total)
                  }}</span>
                </div>
                @if (isOpen(item)) {
                  <ul class="vd__signers">
                    @for (signer of item.signers; track signer.identityId) {
                      <li class="vd__signer">
                        <div class="vd__signer-head">
                          <button
                            type="button"
                            class="vd__toggle"
                            [class.vd__toggle--open]="isSignerOpen(item, signer)"
                            [attr.aria-expanded]="isSignerOpen(item, signer)"
                            [attr.aria-label]="
                              'vdet.expandSigner' | translate: { name: signer.name }
                            "
                            (click)="toggleSigner(item, signer)"
                          >
                            <db-icon name="chevronDown" [size]="15" />
                          </button>
                          <span class="cell vd__who">
                            @if (canOpenSigner() && signer.signerId) {
                              <a
                                class="dba-ref cell__label"
                                [routerLink]="[signersPath, signer.signerId]"
                                >{{ signer.name }}</a
                              >
                            } @else {
                              <span class="cell__label">{{ signer.name }}</span>
                            }
                            <span class="cell__meta">{{
                              signer.identification ?? ('vdet.noIdentification' | translate)
                            }}</span>
                          </span>
                          <span class="dba-meta vd__counts">{{ countsLine(signer.counts) }}</span>
                        </div>
                        @if (isSignerOpen(item, signer)) {
                          <ul class="vd__checks">
                            @for (check of signer.validations; track $index) {
                              <li class="vd__check" [class.vd__check--copy]="check.copy">
                                <span class="cell__text vd__type">{{
                                  'vcon.type.' + check.type | translate
                                }}</span>
                                <span class="dba-meta vd__num">{{ stamp(check.date) }}</span>
                                <dba-org-state
                                  [state]="resultState(check.result)"
                                  variant="inline"
                                  [labelKey]="'vdet.result.' + check.result"
                                />
                                @if (check.retry) {
                                  <span class="dba-meta">{{ 'vdet.retry' | translate }}</span>
                                }
                                @if (check.copy) {
                                  <span class="dba-meta">{{ 'vdet.copy' | translate }}</span>
                                }
                              </li>
                            }
                          </ul>
                        }
                      </li>
                    }
                  </ul>
                }
              }
            </dba-data-table>
          } @empty {
            <div class="bl__panel">
              <dba-empty-state titleKey="vdet.emptyTitle" leadKey="vdet.emptyLead" />
            </div>
          }
          @if (pageCount() > 1) {
            <nav class="vd__pager" [attr.aria-label]="'common.pagination' | translate">
              <span class="dba-meta">{{ 'vdet.range' | translate: rangeParams() }}</span>
              <button
                dba-button
                variant="secondary"
                [attr.aria-label]="'common.prevPage' | translate"
                [disabled]="data.page <= 1"
                (click)="goPage(data.page - 1)"
              >
                <db-icon name="chevronLeft" [size]="14" />
              </button>
              <button
                dba-button
                variant="secondary"
                [attr.aria-label]="'common.nextPage' | translate"
                [disabled]="data.page >= pageCount()"
                (click)="goPage(data.page + 1)"
              >
                <db-icon name="chevronRight" [size]="14" />
              </button>
            </nav>
          }
        }
      }
    </section>
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
  styles: `
    .vd__back {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      align-self: flex-start;
      font-size: var(--dba-text-small);
      font-weight: 600;
      color: var(--dba-violet-700);
      text-decoration: none;
    }

    .vd__back:focus-visible {
      outline: 2px solid var(--dba-violet-500);
      outline-offset: 2px;
    }

    .vd__exports {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .vd__search {
      flex: 1 1 260px;
    }

    .vd__note {
      margin: 0;
    }

    .vd__note--warn {
      color: var(--dba-state-warning-fg);
    }

    .vd__title {
      margin: 8px 0 0;
    }

    .vd__month {
      margin: 6px 0 0;
      font-size: var(--dba-text-cell);
      font-weight: 600;
      color: var(--dba-ink);
    }

    .vd__num {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-id);
      color: var(--dba-ink);
      white-space: nowrap;
    }

    .vd__strong {
      font-weight: 600;
    }

    .vd__toggle {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border: 0;
      border-radius: var(--dba-radius-key);
      background: transparent;
      color: var(--dba-text-muted);
      cursor: pointer;
    }

    .vd__toggle db-icon {
      transition: transform 0.15s ease;
    }

    .vd__toggle--open db-icon {
      transform: rotate(180deg);
    }

    .vd__toggle:hover {
      background: var(--dba-surface-chip);
    }

    .vd__toggle:focus-visible {
      outline: 2px solid var(--dba-violet-500);
    }

    .vd__signers,
    .vd__checks {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .vd__signers {
      padding: 4px 18px 10px 62px;
      border-bottom: 1px solid var(--dba-border-row);
      background: var(--dba-surface);
    }

    .vd__signer + .vd__signer {
      border-top: 1px solid var(--dba-border-row);
    }

    .vd__signer-head {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 44px;
    }

    .vd__who {
      flex: 1 1 auto;
    }

    .vd__counts {
      font-family: var(--dba-font-mono);
      white-space: nowrap;
    }

    .vd__checks {
      padding: 0 0 8px 38px;
    }

    .vd__check {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 14px;
      min-height: 32px;
    }

    .vd__check--copy {
      opacity: 0.72;
    }

    .vd__type {
      min-width: 190px;
    }

    .vd__pager {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
    }

    @media (max-width: 720px) {
      .vd__signers {
        padding-left: 18px;
      }

      .vd__checks {
        padding-left: 0;
      }

      .vd__type {
        min-width: 0;
      }
    }
  `,
})
export class ValidationDetailComponent {
  private readonly api = inject(ConsumptionApi);
  private readonly auth = inject(AuthStore);
  private readonly notify = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();
  private readonly timeZone = browserTimeZone();
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly density = inject(DensityService);
  protected readonly countKeys: readonly CountKey[] = COUNT_KEYS;
  protected readonly monthColumns = MONTH_COLUMNS;
  protected readonly maxSearch = MAX_SEARCH;
  protected readonly listPath = sectionPath('validationConsumption');
  protected readonly documentsPath = sectionPath('documents');
  protected readonly signersPath = sectionPath('signers');
  protected readonly organizationsPath = sectionPath('organizations');
  protected readonly resellersPath = sectionPath('resellers');
  protected readonly scope = signal<DetailScope | null>(
    scopeOf(this.route.snapshot.paramMap.get('alcance')),
  );
  protected readonly entityId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly filters = signal<DetailFilters>(
    detailFiltersOf(this.route.snapshot.queryParams),
  );
  protected readonly state = signal<LoadState>('loading');
  protected readonly detail = signal<ValidationDetail | null>(null);
  protected readonly exporting = signal(false);
  protected readonly open = signal<ReadonlySet<string>>(new Set());
  protected readonly openSigners = signal<ReadonlySet<string>>(new Set());

  protected readonly invalid = computed(() => rangeInvalid(this.filters()));
  protected readonly backParams = computed(() => backParamsOf(this.filters()));
  protected readonly canOpenDocument = computed(() => this.auth.canRead('operations'));
  protected readonly canOpenSigner = computed(() => this.auth.canRead('clients'));
  protected readonly canOpenOrganization = computed(() => this.auth.canRead('clients'));
  protected readonly canOpenReseller = computed(() => this.auth.canRead('commercial'));
  protected readonly canExport = computed(
    () =>
      this.state() === 'ready' && !this.invalid() && !this.exporting() && !!this.detail()?.total,
  );
  protected readonly documentColumns = computed(() =>
    this.scope() === 'reseller' ? RESELLER_DOCUMENT_COLUMNS : DOCUMENT_COLUMNS,
  );
  protected readonly pageMonths = computed(() => monthsOfPage(this.detail()?.items ?? []));
  protected readonly pageCount = computed(() => {
    const data = this.detail();
    return data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  });
  protected readonly rangeParams = computed(() => {
    const data = this.detail();
    if (!data) return { from: 0, to: 0, total: 0 };
    const from = (data.page - 1) * data.limit + 1;
    return {
      from: this.count(from),
      to: this.count(from + data.items.length - 1),
      total: this.count(data.total),
    };
  });

  protected readonly typePills = computed<FilterPill[]>(() => [
    { key: 'todos', labelKey: 'vdet.typeAll' },
    ...COUNT_KEYS.map((key) => ({ key, labelKey: `vcon.type.${key}` })),
  ]);

  protected readonly cells = computed<StatCell[]>(() => {
    const data = this.detail();
    if (!data) return [];
    return [
      {
        key: 'total',
        label: this.text('vcon.stat.total'),
        value: this.count(data.totals.total),
        note: this.text('vcon.stat.totalNote'),
      },
      ...COUNT_KEYS.map((key) => ({
        key,
        label: this.text(`vcon.type.${key}`),
        value: this.count(data.totals[key]),
        note: key === 'otros' ? this.text('vcon.stat.otherNote') : undefined,
      })),
      {
        key: 'value',
        label: this.text('vdet.stat.value'),
        value: data.billing ? this.money(data.billing) : '—',
        note: data.billing ? this.text('vdet.stat.valueNote') : this.text('vcon.noPricing'),
      },
    ];
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
    });
    if (this.scope()) void this.load();
  }

  protected apply(change: Partial<DetailFilters>): void {
    const previous = this.filters();
    const next = { ...previous, ...change, page: change.page ?? 1 };
    this.filters.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: detailQueryParamsOf(next),
      replaceUrl: true,
    });
    if (
      next.from !== previous.from ||
      next.to !== previous.to ||
      next.type !== previous.type ||
      next.search.trim() !== previous.search.trim() ||
      next.page !== previous.page
    )
      void this.load();
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value.slice(0, MAX_SEARCH);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.apply({ search: value }), SEARCH_DELAY);
  }

  protected goPage(page: number): void {
    this.apply({ page });
  }

  protected isOpen(item: DetailItem): boolean {
    return this.open().has(this.keyOf(item));
  }

  protected toggle(item: DetailItem): void {
    this.open.set(this.flip(this.open(), this.keyOf(item)));
  }

  protected isSignerOpen(item: DetailItem, signer: DetailSigner): boolean {
    return this.openSigners().has(`${this.keyOf(item)}|${signer.identityId}`);
  }

  protected toggleSigner(item: DetailItem, signer: DetailSigner): void {
    this.openSigners.set(this.flip(this.openSigners(), `${this.keyOf(item)}|${signer.identityId}`));
  }

  protected count(value: number): string {
    return formatNumber(value, this.locale, '1.0-0');
  }

  protected money(billing: ConsumptionBilling): string {
    return moneyExact(billing.total, billing.currency, this.locale);
  }

  protected monthLabel(month: string): string {
    return monthLabelOf(month, this.locale);
  }

  protected countsLine(counts: ConsumptionCounts): string {
    return (
      COUNT_KEYS.filter((key) => counts[key] > 0)
        .map((key) => `${this.text(`vcon.col.${key}`)} ${this.count(counts[key])}`)
        .join(' · ') || this.count(0)
    );
  }

  protected stamp(date: string): string {
    return new Intl.DateTimeFormat(this.locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: this.timeZone,
    }).format(new Date(date));
  }

  protected resultState(result: DetailResult): string {
    return RESULT_STATES[result];
  }

  protected async load(): Promise<void> {
    const scope = this.scope();
    if (!scope || this.invalid()) return;
    const current = this.latest.start();
    this.state.set('loading');
    try {
      const detail = await firstValueFrom(
        this.api.detail(this.request(scope), this.filters().page, PAGE_SIZE),
      );
      if (!current()) return;
      this.detail.set(detail);
      this.state.set('ready');
    } catch (error) {
      if (!current()) return;
      this.detail.set(null);
      const missing = error instanceof HttpErrorResponse && [400, 404].includes(error.status);
      this.state.set(missing ? 'notFound' : 'failed');
    }
  }

  protected async downloadCsv(): Promise<void> {
    await this.export('csv');
  }

  protected async downloadPdf(): Promise<void> {
    await this.export('pdf');
  }

  private async export(kind: 'csv' | 'pdf'): Promise<void> {
    const scope = this.scope();
    if (!scope || !this.canExport()) return;
    this.exporting.set(true);
    try {
      const request = this.request(scope);
      const file = await firstValueFrom(
        kind === 'csv' ? this.api.detailCsv(request) : this.api.detailPdf(request),
      );
      saveBlob(
        kind === 'csv' ? new Blob(['﻿', file.blob], { type: 'text/csv;charset=utf-8' }) : file.blob,
        file.filename,
      );
    } catch {
      this.notify.error(this.text(`vdet.error.${kind}`));
    } finally {
      this.exporting.set(false);
    }
  }

  private request(scope: DetailScope) {
    return detailRequestOf(scope, this.entityId, this.filters(), this.timeZone);
  }

  private keyOf(item: DetailItem): string {
    return `${item.month}|${item.document.id}`;
  }

  private flip(set: ReadonlySet<string>, key: string): ReadonlySet<string> {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  }

  private text(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}

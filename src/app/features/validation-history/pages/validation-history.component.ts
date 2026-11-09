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
import type { LookupScope } from '../../../shared/http/organization-lookup';
import { LatestRequest } from '../../../shared/http/latest-request';
import { saveBlob } from '../../../shared/http/save-blob';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FieldComponent } from '../../../shared/ui/field.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgPickerComponent } from '../../../shared/ui/org-picker.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { StatBandComponent, type StatCell } from '../../../shared/ui/stat-band.component';
import {
  COUNT_KEYS,
  type ConsumptionBilling,
  type ConsumptionCounts,
  type CountKey,
  type DetailResult,
} from '../../validation-consumption/data/consumption.models';
import { browserTimeZone } from '../../validation-consumption/data/detail-view';
import { ValidationHistoryApi } from '../data/validation-history.api';
import type {
  HistoryFilters,
  HistoryOrganization,
  HistorySigner,
  HistorySignersPage,
  ValidationHistory,
} from '../data/validation-history.models';
import {
  LAST_LEGACY_DAY,
  historyAfterCutoff,
  historyFiltersOf,
  historyQueryParamsOf,
  historyRangeInvalid,
  historyRequestOf,
  nodeKeyOf,
} from '../data/validation-history-view';

const SIGNERS_PAGE = 20;

const SEARCH_DELAY = 350;

const MAX_SEARCH = 80;

const ORGANIZATION_COLUMNS: readonly DataColumn[] = [
  { key: 'toggle', width: '32px' },
  { key: 'organization', labelKey: 'vhis.col.organization', width: 'minmax(0, 1.5fr)' },
  { key: 'signers', labelKey: 'vhis.col.signers', width: '100px', align: 'end' },
  { key: 'ani', labelKey: 'vcon.col.ani', width: '64px', align: 'end' },
  { key: 'liveness', labelKey: 'vcon.col.liveness', width: '64px', align: 'end' },
  { key: 'macherFacial', labelKey: 'vcon.col.macherFacial', width: '64px', align: 'end' },
  { key: 'otros', labelKey: 'vcon.col.otros', width: '64px', align: 'end' },
  { key: 'total', labelKey: 'vcon.col.total', width: '72px', align: 'end' },
  { key: 'value', labelKey: 'vhis.col.value', width: '150px', align: 'end' },
];

const RESULT_STATES: Record<DetailResult, string> = {
  passed: 'active',
  failed: 'suspended',
  retry: 'warning',
  unknown: 'closed',
};

type LoadState = 'loading' | 'ready' | 'failed' | 'notFound';

interface NodePanel {
  status: 'loading' | 'ready' | 'failed';
  search: string;
  page: number;
  data: HistorySignersPage | null;
}

@Component({
  selector: 'dba-validation-history',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    FieldComponent,
    IconComponent,
    OrgPickerComponent,
    OrgStateComponent,
    SectionLoaderComponent,
    StatBandComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.validationHistory' | translate }}</h1>
          <span class="dba-meta">{{ 'vhis.lead' | translate }}</span>
        </div>
        <div class="vh__exports">
          <button
            dba-button
            variant="secondary"
            [disabled]="!canExport()"
            (click)="download('csv')"
          >
            <db-icon name="download" [size]="15" />
            {{ 'vhis.csv' | translate }}
          </button>
          <button
            dba-button
            variant="secondary"
            [disabled]="!canExport()"
            (click)="download('pdf')"
          >
            <db-icon name="download" [size]="15" />
            {{ 'vhis.pdf' | translate }}
          </button>
        </div>
      </header>

      <div class="bl__tools">
        <dba-org-picker
          scope="resellers"
          anyKey="vhis.allResellers"
          labelKey="vhis.resellerLabel"
          [value]="filters().resellerId"
          (picked)="apply({ resellerId: $event, organizationId: null })"
        />
        @if (organizationScope(); as scope) {
          <dba-org-picker
            [scope]="scope"
            anyKey="vhis.allOrganizations"
            labelKey="vhis.organizationLabel"
            [value]="filters().organizationId"
            (picked)="apply({ organizationId: $event, resellerId: null })"
          />
        }
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
          [value]="filters().to"
          (valueChange)="apply({ to: $event || lastDay })"
        />
      </div>
      <p class="dba-meta vh__note">{{ 'vhis.cutoffNote' | translate: { day: lastDayLabel } }}</p>

      @if (afterCutoff()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="vhis.afterCutoffTitle" leadKey="vhis.afterCutoffLead" />
        </div>
      } @else if (invalid()) {
        <p class="dba-meta vh__note">{{ 'vcon.rangeInvalid' | translate }}</p>
      } @else if (state() === 'loading') {
        <db-section-loader [label]="'vhis.loading' | translate" />
      } @else if (state() === 'notFound') {
        <div class="bl__panel">
          <dba-empty-state titleKey="vhis.notFoundTitle" leadKey="vhis.notFoundLead" />
        </div>
      } @else if (state() === 'failed') {
        <div class="bl__panel">
          <dba-empty-state titleKey="vhis.errorTitle" leadKey="vhis.errorLead" />
          <button dba-button variant="secondary" (click)="load()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (report(); as data) {
        <db-stat-band [cells]="cells()" [label]="'vhis.statsLabel' | translate" />
        @if (data.capped) {
          <p class="dba-meta vh__note vh__note--warn">{{ 'vhis.capped' | translate }}</p>
        }
        @if (data.groups.length === 0) {
          <div class="bl__panel">
            <dba-empty-state titleKey="vhis.emptyTitle" leadKey="vhis.emptyLead" />
          </div>
        } @else {
          <p class="dba-meta vh__note">{{ 'vhis.countNote' | translate }}</p>
          @for (group of data.groups; track group.reseller?.id ?? 'none') {
            <div class="vh__group">
              <div class="vh__group-head">
                <h2 class="dba-section vh__group-name">
                  @if (group.reseller && canOpenReseller()) {
                    <a class="dba-ref" [routerLink]="[resellersPath, group.reseller.id]">{{
                      group.reseller.businessName
                    }}</a>
                  } @else {
                    {{ group.reseller?.businessName ?? ('vhis.noReseller' | translate) }}
                  }
                </h2>
                <span class="dba-meta vh__num">{{
                  'vhis.groupSummary'
                    | translate
                      : { signers: count(group.signers), validations: count(group.counts.total) }
                }}</span>
                @if (group.reseller) {
                  <span class="vh__group-value">
                    @if (group.billing) {
                      <span class="cell__amount">{{ money(group.billing) }}</span>
                    } @else {
                      <span class="cell__muted">{{ 'vcon.noPricing' | translate }}</span>
                    }
                  </span>
                }
              </div>
              <dba-data-table
                [columns]="organizationColumns"
                [label]="
                  'vhis.groupLabel'
                    | translate
                      : { name: group.reseller?.businessName ?? ('vhis.noReseller' | translate) }
                "
                [dense]="density.compact()"
                minWidth="900px"
              >
                @for (node of group.organizations; track keyOf(node)) {
                  <div class="dba-tr" [class.dba-tr--on]="isOpen(node)">
                    <span class="dba-td">
                      <button
                        type="button"
                        class="vh__toggle"
                        [class.vh__toggle--open]="isOpen(node)"
                        [attr.aria-expanded]="isOpen(node)"
                        [attr.aria-label]="'vhis.expand' | translate: { name: nameOf(node) }"
                        (click)="toggle(node)"
                      >
                        <db-icon name="chevronDown" [size]="15" />
                      </button>
                    </span>
                    <span class="dba-td cell">
                      @if (node.organization && canOpenOrganization()) {
                        <a
                          class="dba-ref cell__label"
                          [routerLink]="[organizationsPath, node.organization.id]"
                          >{{ node.organization.businessName }}</a
                        >
                      } @else {
                        <span class="cell__label">{{ nameOf(node) }}</span>
                      }
                    </span>
                    <span class="dba-td dba-td--end vh__num">{{ count(node.signers) }}</span>
                    @for (key of countKeys; track key) {
                      <span class="dba-td dba-td--end vh__num">{{ count(node.counts[key]) }}</span>
                    }
                    <span class="dba-td dba-td--end vh__num vh__strong">{{
                      count(node.counts.total)
                    }}</span>
                    <span class="dba-td dba-td--end">
                      @if (node.billing) {
                        <span class="cell__amount">{{ money(node.billing) }}</span>
                      } @else {
                        <span class="cell__muted">{{ 'vcon.noPricing' | translate }}</span>
                      }
                    </span>
                  </div>
                  @if (panelOf(node); as panel) {
                    <div class="vh__panel">
                      <label class="bl__search vh__search">
                        <db-icon name="search" [size]="15" />
                        <input
                          type="search"
                          class="bl__input"
                          autocomplete="off"
                          [attr.maxlength]="maxSearch"
                          [attr.aria-label]="'vhis.searchLabel' | translate"
                          [placeholder]="'vhis.searchPlaceholder' | translate"
                          [value]="panel.search"
                          (input)="onSearch(node, $event)"
                        />
                      </label>
                      @if (panel.status === 'loading') {
                        <db-section-loader [label]="'vhis.signersLoading' | translate" />
                      } @else if (panel.status === 'failed') {
                        <p class="dba-meta vh__note">{{ 'vhis.signersError' | translate }}</p>
                        <button dba-button variant="secondary" (click)="reloadPanel(node)">
                          {{ 'common.retry' | translate }}
                        </button>
                      } @else if (panel.data; as page) {
                        @if (page.items.length === 0) {
                          <p class="dba-meta vh__note">{{ 'vhis.signersEmpty' | translate }}</p>
                        } @else {
                          <ul class="vh__signers">
                            @for (signer of page.items; track signer.id) {
                              <li class="vh__signer">
                                <div class="vh__signer-head">
                                  <button
                                    type="button"
                                    class="vh__toggle"
                                    [class.vh__toggle--open]="isSignerOpen(node, signer)"
                                    [attr.aria-expanded]="isSignerOpen(node, signer)"
                                    [attr.aria-label]="
                                      'vhis.expandSigner' | translate: { name: signer.name }
                                    "
                                    (click)="toggleSigner(node, signer)"
                                  >
                                    <db-icon name="chevronDown" [size]="15" />
                                  </button>
                                  <span class="cell vh__who">
                                    @if (canOpenSigner()) {
                                      <a
                                        class="dba-ref cell__label"
                                        [routerLink]="[signersPath, signer.id]"
                                        >{{ signer.name }}</a
                                      >
                                    } @else {
                                      <span class="cell__label">{{ signer.name }}</span>
                                    }
                                    <span class="cell__meta">
                                      {{
                                        signer.identification ??
                                          ('vdet.noIdentification' | translate)
                                      }}
                                      @if (signer.organizations > 1) {
                                        ·
                                        {{
                                          'vhis.multiOrg'
                                            | translate: { count: count(signer.organizations) }
                                        }}
                                      }
                                    </span>
                                  </span>
                                  <span class="dba-meta vh__counts">{{
                                    countsLine(signer.counts)
                                  }}</span>
                                </div>
                                @if (isSignerOpen(node, signer)) {
                                  <ul class="vh__checks">
                                    @for (check of signer.validations; track $index) {
                                      <li class="vh__check" [class.vh__check--copy]="check.copy">
                                        <span class="cell__text vh__type">{{
                                          'vcon.type.' + check.type | translate
                                        }}</span>
                                        <span class="dba-meta vh__num">{{
                                          stamp(check.date)
                                        }}</span>
                                        <dba-org-state
                                          [state]="resultState(check.result)"
                                          variant="inline"
                                          [labelKey]="'vdet.result.' + check.result"
                                        />
                                        @if (check.retry) {
                                          <span class="dba-meta">{{
                                            'vdet.retry' | translate
                                          }}</span>
                                        }
                                        @if (check.copy) {
                                          <span class="dba-meta">{{
                                            'vdet.copy' | translate
                                          }}</span>
                                        }
                                      </li>
                                    }
                                  </ul>
                                }
                              </li>
                            }
                          </ul>
                          @if (page.total > page.limit) {
                            <nav
                              class="vh__pager"
                              [attr.aria-label]="'common.pagination' | translate"
                            >
                              <span class="dba-meta">{{
                                'vhis.range' | translate: rangeOf(page)
                              }}</span>
                              <button
                                dba-button
                                variant="secondary"
                                [attr.aria-label]="'common.prevPage' | translate"
                                [disabled]="page.page <= 1"
                                (click)="goPanelPage(node, page.page - 1)"
                              >
                                <db-icon name="chevronLeft" [size]="14" />
                              </button>
                              <button
                                dba-button
                                variant="secondary"
                                [attr.aria-label]="'common.nextPage' | translate"
                                [disabled]="page.page * page.limit >= page.total"
                                (click)="goPanelPage(node, page.page + 1)"
                              >
                                <db-icon name="chevronRight" [size]="14" />
                              </button>
                            </nav>
                          }
                        }
                      }
                    </div>
                  }
                }
              </dba-data-table>
            </div>
          }
        }
      }
    </section>
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
  styles: `
    .vh__exports {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .vh__note {
      margin: 0;
    }

    .vh__note--warn {
      color: var(--dba-state-warning-fg);
    }

    .vh__group {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .vh__group-head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 6px 14px;
      margin-top: 8px;
    }

    .vh__group-name {
      margin: 0;
    }

    .vh__group-value {
      margin-left: auto;
    }

    .vh__num {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-id);
      color: var(--dba-ink);
      white-space: nowrap;
    }

    .vh__strong {
      font-weight: 600;
    }

    .vh__toggle {
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

    .vh__toggle db-icon {
      transition: transform 0.15s ease;
    }

    .vh__toggle--open db-icon {
      transform: rotate(180deg);
    }

    .vh__toggle:hover {
      background: var(--dba-surface-chip);
    }

    .vh__toggle:focus-visible {
      outline: 2px solid var(--dba-violet-500);
    }

    .vh__panel {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
      padding: 10px 18px 12px 62px;
      border-bottom: 1px solid var(--dba-border-row);
      background: var(--dba-surface);
    }

    .vh__search {
      flex: 0 1 auto;
      width: min(360px, 100%);
    }

    .vh__signers,
    .vh__checks {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .vh__signers {
      align-self: stretch;
    }

    .vh__signer + .vh__signer {
      border-top: 1px solid var(--dba-border-row);
    }

    .vh__signer-head {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 44px;
    }

    .vh__who {
      flex: 1 1 auto;
    }

    .vh__counts {
      font-family: var(--dba-font-mono);
      white-space: nowrap;
    }

    .vh__checks {
      padding: 0 0 8px 38px;
    }

    .vh__check {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 14px;
      min-height: 32px;
    }

    .vh__check--copy {
      opacity: 0.72;
    }

    .vh__type {
      min-width: 190px;
    }

    .vh__pager {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      align-self: stretch;
      gap: 8px;
    }

    @media (max-width: 720px) {
      .vh__panel {
        padding-left: 18px;
      }

      .vh__checks {
        padding-left: 0;
      }

      .vh__type {
        min-width: 0;
      }
    }
  `,
})
export class ValidationHistoryComponent {
  private readonly api = inject(ValidationHistoryApi);
  private readonly auth = inject(AuthStore);
  private readonly notify = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();
  private readonly timeZone = browserTimeZone();
  private readonly panelTokens = new Map<string, number>();
  private readonly searchTimers = new Map<string, ReturnType<typeof setTimeout>>();

  protected readonly density = inject(DensityService);
  protected readonly countKeys: readonly CountKey[] = COUNT_KEYS;
  protected readonly organizationColumns = ORGANIZATION_COLUMNS;
  protected readonly maxSearch = MAX_SEARCH;
  protected readonly lastDay = LAST_LEGACY_DAY;
  protected readonly lastDayLabel = new Intl.DateTimeFormat(this.locale, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${LAST_LEGACY_DAY}T12:00:00Z`));
  protected readonly organizationsPath = sectionPath('organizations');
  protected readonly signersPath = sectionPath('signers');
  protected readonly resellersPath = sectionPath('resellers');
  protected readonly filters = signal<HistoryFilters>(
    historyFiltersOf(this.route.snapshot.queryParams),
  );
  protected readonly state = signal<LoadState>('loading');
  protected readonly report = signal<ValidationHistory | null>(null);
  protected readonly exporting = signal(false);
  protected readonly panels = signal<ReadonlyMap<string, NodePanel>>(new Map());
  protected readonly openSigners = signal<ReadonlySet<string>>(new Set());

  protected readonly afterCutoff = computed(() => historyAfterCutoff(this.filters()));
  protected readonly invalid = computed(
    () => !this.afterCutoff() && historyRangeInvalid(this.filters()),
  );
  protected readonly canOpenOrganization = computed(() => this.auth.canRead('clients'));
  protected readonly canOpenSigner = computed(() => this.auth.canRead('clients'));
  protected readonly canOpenReseller = computed(() => this.auth.canRead('commercial'));
  protected readonly organizationScope = computed<LookupScope | null>(() =>
    this.auth.canRead('clients')
      ? 'clients'
      : this.auth.canRead('commercial')
        ? 'commercial'
        : null,
  );
  protected readonly canExport = computed(
    () =>
      this.state() === 'ready' &&
      !this.invalid() &&
      !this.afterCutoff() &&
      !this.exporting() &&
      !!this.report()?.totals.total,
  );

  protected readonly cells = computed<StatCell[]>(() => {
    const data = this.report();
    if (!data) return [];
    return [
      {
        key: 'total',
        label: this.text('vhis.stat.validations'),
        value: this.count(data.totals.total),
        note: this.text('vhis.stat.validationsNote'),
      },
      {
        key: 'signers',
        label: this.text('vhis.stat.signers'),
        value: this.count(data.signers),
        note: this.text('vhis.stat.signersNote'),
      },
      ...COUNT_KEYS.map((key) => ({
        key,
        label: this.text(`vcon.type.${key}`),
        value: this.count(data.totals[key]),
      })),
    ];
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      for (const timer of this.searchTimers.values()) clearTimeout(timer);
    });
    void this.load();
  }

  protected apply(change: Partial<HistoryFilters>): void {
    const previous = this.filters();
    const next = { ...previous, ...change };
    this.filters.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: historyQueryParamsOf(next),
      replaceUrl: true,
    });
    if (
      next.resellerId !== previous.resellerId ||
      next.organizationId !== previous.organizationId ||
      next.from !== previous.from ||
      next.to !== previous.to
    )
      void this.load();
  }

  protected keyOf(node: HistoryOrganization): string {
    return nodeKeyOf(node);
  }

  protected nameOf(node: HistoryOrganization): string {
    return node.organization?.businessName ?? this.text('vhis.noOrganization');
  }

  protected isOpen(node: HistoryOrganization): boolean {
    return this.panels().has(nodeKeyOf(node));
  }

  protected panelOf(node: HistoryOrganization): NodePanel | undefined {
    return this.panels().get(nodeKeyOf(node));
  }

  protected toggle(node: HistoryOrganization): void {
    const key = nodeKeyOf(node);
    if (this.panels().has(key)) {
      const next = new Map(this.panels());
      next.delete(key);
      this.panels.set(next);
      this.panelTokens.delete(key);
      return;
    }
    void this.loadPanel(key, '', 1);
  }

  protected reloadPanel(node: HistoryOrganization): void {
    const panel = this.panelOf(node);
    void this.loadPanel(nodeKeyOf(node), panel?.search ?? '', panel?.page ?? 1);
  }

  protected goPanelPage(node: HistoryOrganization, page: number): void {
    void this.loadPanel(nodeKeyOf(node), this.panelOf(node)?.search ?? '', page);
  }

  protected onSearch(node: HistoryOrganization, event: Event): void {
    const key = nodeKeyOf(node);
    const value = (event.target as HTMLInputElement).value.slice(0, MAX_SEARCH);
    const pending = this.searchTimers.get(key);
    if (pending) clearTimeout(pending);
    this.searchTimers.set(
      key,
      setTimeout(() => {
        this.searchTimers.delete(key);
        if (this.panels().has(key)) void this.loadPanel(key, value, 1);
      }, SEARCH_DELAY),
    );
  }

  protected isSignerOpen(node: HistoryOrganization, signer: HistorySigner): boolean {
    return this.openSigners().has(`${nodeKeyOf(node)}|${signer.id}`);
  }

  protected toggleSigner(node: HistoryOrganization, signer: HistorySigner): void {
    const key = `${nodeKeyOf(node)}|${signer.id}`;
    const next = new Set(this.openSigners());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.openSigners.set(next);
  }

  protected count(value: number): string {
    return formatNumber(value, this.locale, '1.0-0');
  }

  protected money(billing: ConsumptionBilling): string {
    return moneyExact(billing.total, billing.currency, this.locale);
  }

  protected countsLine(counts: ConsumptionCounts): string {
    return (
      COUNT_KEYS.filter((key) => counts[key] > 0)
        .map((key) => `${this.text(`vcon.col.${key}`)} ${this.count(counts[key])}`)
        .join(' · ') || this.count(0)
    );
  }

  protected rangeOf(page: HistorySignersPage) {
    const from = (page.page - 1) * page.limit + 1;
    return {
      from: this.count(from),
      to: this.count(from + page.items.length - 1),
      total: this.count(page.total),
    };
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
    const current = this.latest.start();
    this.panels.set(new Map());
    this.panelTokens.clear();
    this.openSigners.set(new Set());
    if (this.invalid() || this.afterCutoff()) {
      this.report.set(null);
      return;
    }
    this.state.set('loading');
    try {
      const report = await firstValueFrom(this.api.report(this.request()));
      if (!current()) return;
      this.report.set(report);
      this.state.set('ready');
    } catch (error) {
      if (!current()) return;
      this.report.set(null);
      const missing = error instanceof HttpErrorResponse && [400, 404].includes(error.status);
      this.state.set(missing ? 'notFound' : 'failed');
    }
  }

  protected async download(kind: 'csv' | 'pdf'): Promise<void> {
    if (!this.canExport()) return;
    this.exporting.set(true);
    try {
      const request = this.request();
      const file = await firstValueFrom(
        kind === 'csv' ? this.api.csv(request) : this.api.pdf(request),
      );
      saveBlob(
        kind === 'csv' ? new Blob(['﻿', file.blob], { type: 'text/csv;charset=utf-8' }) : file.blob,
        file.filename,
      );
    } catch {
      this.notify.error(this.text(`vhis.error.${kind}`));
    } finally {
      this.exporting.set(false);
    }
  }

  private async loadPanel(key: string, search: string, page: number): Promise<void> {
    const token = (this.panelTokens.get(key) ?? 0) + 1;
    this.panelTokens.set(key, token);
    this.setPanel(key, {
      status: 'loading',
      search,
      page,
      data: this.panels().get(key)?.data ?? null,
    });
    try {
      const data = await firstValueFrom(
        this.api.signers(this.request(), key, search, page, SIGNERS_PAGE),
      );
      if (this.panelTokens.get(key) !== token) return;
      this.setPanel(key, { status: 'ready', search, page, data });
    } catch {
      if (this.panelTokens.get(key) !== token) return;
      this.setPanel(key, { status: 'failed', search, page, data: null });
    }
  }

  private setPanel(key: string, panel: NodePanel): void {
    const next = new Map(this.panels());
    next.set(key, panel);
    this.panels.set(next);
  }

  private request() {
    return historyRequestOf(this.filters(), this.timeZone);
  }

  private text(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}

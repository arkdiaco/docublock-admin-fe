import { formatDate } from '@angular/common';
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
import { sectionPath } from '../../../core/layout/console-nav';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { DensityService } from '../../../core/preferences/density.service';
import { quotaToneOf } from '../../../shared/domain/org-state';
import { ExportState } from '../../../shared/http/export-state';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FilterPillsComponent, type FilterPill } from '../../../shared/ui/filter-pills.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { OrganizationsApi } from '../data/organizations.api';
import type { PlatformOrgRow, PlatformOrgState, PlatformStateCounts } from '../data/organizations.models';
import { orgStateView } from '../data/platform-org-state';

const LIMIT = 20;
const DEBOUNCE_MS = 350;

const COLUMNS: readonly DataColumn[] = [
  { key: 'org', labelKey: 'org.col.name', width: 'minmax(0, 1.8fr)' },
  { key: 'country', labelKey: 'orgs.col.country', width: '120px' },
  { key: 'plan', labelKey: 'org.col.plan', width: '150px' },
  { key: 'documents', labelKey: 'orgs.col.documents', width: '160px' },
  { key: 'members', labelKey: 'orgs.col.members', width: '90px', align: 'end' },
  { key: 'state', labelKey: 'org.col.state', width: '140px' },
  { key: 'chevron', width: '40px', align: 'end' },
];

const EMPTY_COUNTS: PlatformStateCounts = {
  total: 0,
  active: 0,
  suspended: 0,
  expired: 0,
  no_subscription: 0,
};

interface RowView extends PlatformOrgRow {
  initials: string;
  docsText: string;
  docsPct: string;
  docsTone: string;
  stateFamily: string;
  stateLabel: string;
  validity: string;
}

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || name.slice(0, 2).toUpperCase();

@Component({
  selector: 'dba-organizations',
  imports: [
    TranslatePipe,
    ButtonComponent,
    IconComponent,
    DataTableComponent,
    FilterPillsComponent,
    OrgStateComponent,
    EmptyStateComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="orgs">
      <header class="orgs__head">
        <div class="orgs__title">
          <h1 class="dba-page">{{ 'nav.organizations' | translate }}</h1>
          <span class="dba-meta orgs__total">{{ 'orgs.count' | translate: { total: counts().total } }}</span>
        </div>
        <button dba-button variant="secondary" [busy]="exporting.busy()" [disabled]="loading() || rows().length === 0" (click)="exportCsv()">
          <db-icon name="download" [size]="15" />
          {{ 'orgs.csv' | translate }}
        </button>
      </header>

      <div class="orgs__tools">
        <label class="orgs__search">
          <db-icon name="search" [size]="15" />
          <input
            type="search"
            class="orgs__input"
            autocomplete="off"
            [placeholder]="'orgs.searchPlaceholder' | translate"
            [value]="searchDraft()"
            (input)="onSearch($event)"
          />
        </label>
        <db-filter-pills [pills]="pills()" [active]="state() || 'all'" (activeChange)="pickState($event)" />
      </div>

      @if (loading()) {
        <db-section-loader [label]="'orgs.loading' | translate" />
      } @else if (error()) {
        <div class="orgs__panel">
          <dba-empty-state titleKey="orgs.errorTitle" leadKey="orgs.errorLead" />
          <button dba-button variant="secondary" (click)="reload()">{{ 'common.retry' | translate }}</button>
        </div>
      } @else if (rows().length === 0) {
        <div class="orgs__panel">
          <dba-empty-state titleKey="orgs.emptyTitle" leadKey="orgs.emptyLead" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'nav.organizations' | translate"
          [dense]="density.compact()"
          minWidth="920px"
          [total]="total()"
          [from]="from()"
          [to]="to()"
          [page]="page()"
          [pageCount]="pageCount()"
          (pageChange)="goPage($event)"
        >
          @for (row of rows(); track row.id) {
            <button type="button" class="dba-tr" (click)="open(row)">
              <div class="dba-td org-cell">
                <span class="org-cell__avatar" aria-hidden="true">{{ row.initials }}</span>
                <span class="org-cell__text">
                  <span class="org-cell__name">{{ row.businessName }}</span>
                  <span class="org-cell__nit">{{ row.tributaryNumber }}</span>
                </span>
              </div>
              <span class="dba-td orgs__country">{{ row.countryName || '—' }}</span>
              <span class="dba-td orgs__plan">
                <span class="orgs__planName">{{ row.plan?.name || ('orgs.noPlan' | translate) }}</span>
                @if (row.validity) {
                  <span class="orgs__validity">{{ row.validity }}</span>
                }
              </span>
              <span class="dba-td usage">
                <code class="usage__value">{{ row.docsText }}</code>
                <span class="usage__track"><span class="usage__fill" [class]="'usage__fill usage__fill--' + row.docsTone" [style.width]="row.docsPct"></span></span>
              </span>
              <code class="dba-td dba-td--end orgs__members">{{ row.members }}</code>
              <span class="dba-td orgs__state">
                <dba-org-state [state]="row.stateFamily" [labelKey]="row.stateLabel" variant="inline" />
                @if (row.warning) {
                  <span class="orgs__warn" [title]="'orgs.warning' | translate" aria-hidden="true"></span>
                }
              </span>
              <db-icon class="dba-td dba-td--end org-chevron" name="chevronRight" [size]="15" />
            </button>
          }
        </dba-data-table>
      }
    </section>
  `,
  styles: `
    .orgs {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .orgs__head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
    }

    .orgs__title {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .orgs__tools {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
    }

    .orgs__search {
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

    .orgs__search:focus-within {
      border-color: var(--dba-violet-500);
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .orgs__input {
      flex: 1;
      min-width: 0;
      height: 100%;
      border: 0;
      background: transparent;
      font-family: var(--dba-font-ui);
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
    }

    .orgs__input:focus {
      outline: none;
    }

    .orgs__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .org-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .org-cell__avatar {
      display: flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: var(--dba-radius-avatar);
      background: var(--dba-violet-100);
      font-size: var(--dba-text-eyebrow);
      font-weight: 700;
      color: var(--dba-violet-700);
    }

    .org-cell__text {
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .org-cell__name {
      font-size: var(--dba-text-cell);
      font-weight: 500;
      color: var(--dba-ink);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .org-cell__nit {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }

    .orgs__country {
      font-size: var(--dba-text-label);
      color: var(--dba-text);
    }

    .orgs__plan {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .orgs__planName {
      font-size: var(--dba-text-label);
      color: var(--dba-ink);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .orgs__validity {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }

    .usage {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .usage__value {
      flex: none;
      width: 72px;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-small);
      color: var(--dba-text);
      white-space: nowrap;
    }

    .usage__track {
      flex: 1;
      display: flex;
      height: 5px;
      border-radius: var(--dba-radius-bar);
      background: var(--dba-border-row);
      overflow: hidden;
    }

    .usage__fill {
      background: var(--dba-quota-ok);
    }

    .usage__fill--warn {
      background: var(--dba-quota-warn);
    }

    .usage__fill--over {
      background: var(--dba-quota-over);
    }

    .orgs__members {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-small);
      color: var(--dba-text);
    }

    .orgs__state {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .orgs__warn {
      width: 7px;
      height: 7px;
      border-radius: var(--dba-radius-pill);
      background: var(--dba-quota-warn);
    }

    .org-chevron {
      color: var(--dba-text-faint);
    }

    @media (max-width: 640px) {
      .orgs__head {
        flex-direction: column;
        align-items: stretch;
      }

      .orgs__search {
        width: 100%;
      }
    }
  `,
})
export class OrganizationsComponent {
  private readonly api = inject(OrganizationsApi);
  private readonly router = inject(Router);
  private readonly locale = inject(LOCALE_ID);
  protected readonly density = inject(DensityService);
  protected readonly exporting = new ExportState();
  private readonly latest = new LatestRequest();

  protected readonly columns = COLUMNS;
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly rows = signal<RowView[]>([]);
  protected readonly total = signal(0);
  protected readonly counts = signal<PlatformStateCounts>(EMPTY_COUNTS);
  protected readonly page = signal(1);
  protected readonly state = signal<PlatformOrgState | ''>('');
  protected readonly searchDraft = signal('');

  private search = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly from = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * LIMIT + 1));
  protected readonly to = computed(() => Math.min(this.total(), this.page() * LIMIT));

  protected readonly pills = computed<FilterPill[]>(() => {
    const c = this.counts();
    return [
      { key: 'all', labelKey: 'orgs.filterAll', count: c.total },
      { key: 'active', labelKey: 'orgs.state.active', count: c.active },
      { key: 'suspended', labelKey: 'orgs.state.suspended', count: c.suspended, danger: true },
      { key: 'expired', labelKey: 'orgs.state.expired', count: c.expired },
      { key: 'no_subscription', labelKey: 'orgs.state.no_subscription', count: c.no_subscription },
    ];
  });

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
      this.page.set(1);
      void this.reload();
    }, DEBOUNCE_MS);
  }

  protected pickState(key: string): void {
    this.state.set(key === 'all' ? '' : (key as PlatformOrgState));
    this.page.set(1);
    void this.reload();
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.reload();
  }

  protected open(row: RowView): void {
    void this.router.navigate([sectionPath('organizations'), row.id]);
  }

  protected exportCsv(): void {
    void this.exporting.run(
      this.api.exportCsv({ search: this.search || undefined, state: this.state() || undefined }),
    );
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const result = await firstValueFrom(
        this.api.list({
          page: this.page(),
          limit: LIMIT,
          search: this.search || undefined,
          state: this.state() || undefined,
        }),
      );
      if (!current()) return;
      this.total.set(result.total);
      this.counts.set(result.counts);
      this.rows.set(result.items.map((row) => this.toView(row)));
    } catch {
      if (!current()) return;
      this.error.set(true);
      this.rows.set([]);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  private toView(row: PlatformOrgRow): RowView {
    const view = orgStateView(row.state);
    const limit = row.documents.limit;
    return {
      ...row,
      initials: initialsOf(row.businessName),
      docsText: `${row.documents.used} / ${limit === null ? '∞' : limit}`,
      docsPct: `${limit && limit > 0 ? Math.min(100, (row.documents.used / limit) * 100) : 0}%`,
      docsTone: quotaToneOf(row.documents.used, limit),
      stateFamily: view.family,
      stateLabel: view.labelKey,
      validity: row.periodEnd ? formatDate(row.periodEnd, 'd/MM/y', this.locale) : '',
    };
  }
}

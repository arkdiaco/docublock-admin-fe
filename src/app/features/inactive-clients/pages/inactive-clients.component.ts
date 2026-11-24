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
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { LatestRequest } from '../../../shared/http/latest-request';
import { PluralKeyPipe } from '../../../shared/i18n/plural-key.pipe';
import { safeDate } from '../../../shared/i18n/safe-date';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { StatBandComponent, type StatCell } from '../../../shared/ui/stat-band.component';
import { InactiveClientsApi } from '../data/inactive-clients.api';
import type {
  InactiveOrganizationRow,
  InactiveOrganizationsPage,
} from '../data/inactive-clients.models';

const LIMIT = 20;
const DEBOUNCE_MS = 350;

const COLUMNS: readonly DataColumn[] = [
  { key: 'org', labelKey: 'inactive.col.org', width: 'minmax(0, 1.6fr)' },
  { key: 'state', labelKey: 'inactive.col.state', width: '130px' },
  { key: 'last', labelKey: 'inactive.col.last', width: '160px' },
  { key: 'signed', labelKey: 'inactive.col.signed', width: '150px' },
  { key: 'plan', labelKey: 'inactive.col.plan', width: '180px' },
  { key: 'email', labelKey: 'inactive.col.email', width: 'minmax(0, 1fr)' },
  { key: 'chevron', width: '40px', align: 'end' },
];

@Component({
  selector: 'dba-inactive-clients',
  imports: [
    TranslatePipe,
    PluralKeyPipe,
    ButtonComponent,
    IconComponent,
    DataTableComponent,
    OrgStateComponent,
    EmptyStateComponent,
    SectionLoaderComponent,
    StatBandComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="inactive">
      <header class="inactive__head">
        <h1 class="dba-page">{{ 'nav.inactiveClients' | translate }}</h1>
        <span class="dba-meta">{{ 'inactive.lead' | translate: { months: months() } }}</span>
      </header>

      @if (page()) {
        <db-stat-band [label]="'nav.inactiveClients' | translate" [cells]="cells()" />
      }

      <label class="inactive__search">
        <db-icon name="search" [size]="15" />
        <input
          type="search"
          class="inactive__input"
          autocomplete="off"
          [placeholder]="'inactive.searchPlaceholder' | translate"
          [value]="searchDraft()"
          (input)="onSearch($event)"
        />
      </label>

      @if (loading()) {
        <db-section-loader [label]="'inactive.loading' | translate" />
      } @else if (error()) {
        <div class="inactive__panel">
          <dba-empty-state titleKey="inactive.errorTitle" />
          <button dba-button variant="secondary" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (!page()?.computedAt) {
        <div class="inactive__panel">
          <dba-empty-state
            titleKey="inactive.notComputedTitle"
            leadKey="inactive.notComputedLead"
          />
        </div>
      } @else if (rows().length === 0) {
        <div class="inactive__panel">
          <dba-empty-state titleKey="inactive.emptyTitle" leadKey="inactive.emptyLead" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'nav.inactiveClients' | translate"
          [dense]="density.compact()"
          minWidth="1080px"
          [total]="total()"
          [from]="from()"
          [to]="to()"
          [page]="pageNumber()"
          [pageCount]="pageCount()"
          (pageChange)="goPage($event)"
        >
          @for (row of rows(); track row.organization.id) {
            <button type="button" class="dba-tr" (click)="open(row)">
              <span class="dba-td cell">
                <span class="cell__label">{{ row.organization.businessName }}</span>
                <span class="cell__meta">{{ row.organization.tributaryNumber }}</span>
              </span>
              <span class="dba-td">
                <dba-org-state
                  [state]="row.organization.suspended ? 'suspended' : 'active'"
                  [labelKey]="
                    row.organization.suspended
                      ? 'inactive.state.suspended'
                      : 'inactive.state.active'
                  "
                  variant="inline"
                />
              </span>
              <span class="dba-td cell">
                <span class="dba-mono">{{ day(row.lastActivityAt) }}</span>
                <span class="cell__meta cell__meta--warn">{{
                  'inactive.monthsAgo'
                    | pluralKey: row.monthsInactive
                    | translate: { n: row.monthsInactive }
                }}</span>
              </span>
              <span class="dba-td cell">
                <span class="cell__label">{{
                  'inactive.signedOf'
                    | translate: { signed: row.signedDocuments, total: row.documents }
                }}</span>
                <span class="cell__meta">{{ 'inactive.signedMeta' | translate }}</span>
              </span>
              <span class="dba-td cell">
                @if (row.plan; as plan) {
                  <span class="cell__label">{{ plan.name }}</span>
                  <span class="cell__meta"
                    >{{ plan.code }} · {{ 'inactive.planState.' + plan.state | translate }}</span
                  >
                } @else {
                  <span class="dba-meta">{{ 'inactive.noPlan' | translate }}</span>
                }
              </span>
              <span class="dba-td cell">
                <span class="cell__label cell__label--plain">{{
                  row.organization.email || '—'
                }}</span>
              </span>
              <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
            </button>
          }
        </dba-data-table>
      }
    </section>
  `,
  styles: `
    .inactive {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .inactive__head {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .inactive__search {
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

    .inactive__search:focus-within {
      border-color: var(--dba-violet-500);
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .inactive__input {
      flex: 1;
      min-width: 0;
      height: 100%;
      border: 0;
      background: transparent;
      font-family: var(--dba-font-ui);
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
    }

    .inactive__input:focus {
      outline: none;
    }

    .inactive__panel {
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
      min-width: 0;
    }

    .cell__label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--dba-text-cell);
      font-weight: 500;
      color: var(--dba-ink);
    }

    .cell__label--plain {
      font-weight: 400;
      color: var(--dba-text);
    }

    .cell__meta {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
    }

    .cell__meta--warn {
      color: var(--dba-state-suspended-fg);
    }
  `,
})
export class InactiveClientsComponent {
  private readonly api = inject(InactiveClientsApi);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly page = signal<InactiveOrganizationsPage | null>(null);
  protected readonly pageNumber = signal(1);
  protected readonly searchDraft = signal('');
  private search = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly rows = computed<InactiveOrganizationRow[]>(() => this.page()?.items ?? []);
  protected readonly total = computed(() => this.page()?.total ?? 0);
  protected readonly months = computed(() => this.page()?.months ?? 6);
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly from = computed(() =>
    this.total() === 0 ? 0 : (this.pageNumber() - 1) * LIMIT + 1,
  );
  protected readonly to = computed(() => Math.min(this.total(), this.pageNumber() * LIMIT));

  protected readonly cells = computed<StatCell[]>(() => {
    const data = this.page();
    if (!data) return [];
    return [
      {
        key: 'total',
        label: this.label('inactive.band.total'),
        value: String(data.total),
        note: this.label('inactive.band.totalNote'),
        tone: data.total > 0 ? 'warn' : 'plain',
      },
      {
        key: 'cutoff',
        label: this.label('inactive.band.cutoff'),
        value: this.day(data.cutoff),
        note: this.label('inactive.band.cutoffNote', { months: data.months }),
      },
      {
        key: 'computed',
        label: this.label('inactive.band.computed'),
        value: data.computedAt ? safeDate(data.computedAt, 'd/MM/y, H:mm', this.locale) : '—',
        note: this.label('inactive.band.computedNote'),
      },
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
      this.pageNumber.set(1);
      void this.reload();
    }, DEBOUNCE_MS);
  }

  protected goPage(page: number): void {
    this.pageNumber.set(page);
    void this.reload();
  }

  protected open(row: InactiveOrganizationRow): void {
    void this.router.navigate([sectionPath('organizations'), row.organization.id]);
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const result = await firstValueFrom(
        this.api.list({ search: this.search || undefined, page: this.pageNumber(), limit: LIMIT }),
      );
      if (!current()) return;
      this.page.set(result);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  protected day(value: string): string {
    return safeDate(value, 'd/MM/y', this.locale);
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}

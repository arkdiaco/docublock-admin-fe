import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  LOCALE_ID,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { LatestRequest } from '../../../shared/http/latest-request';
import { PluralKeyPipe } from '../../../shared/i18n/plural-key.pipe';
import { safeDate, type DateInput } from '../../../shared/i18n/safe-date';
import { ActionMenuComponent, type ActionMenuItem } from '../../../shared/ui/action-menu.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { StatBandComponent, type StatCell } from '../../../shared/ui/stat-band.component';
import { InactiveExportDialogComponent } from '../components/inactive-export-dialog.component';
import { InactiveClientsApi } from '../data/inactive-clients.api';
import type {
  InactiveOrganizationRow,
  InactiveOrganizationsPage,
} from '../data/inactive-clients.models';
import { rowExportStageOf, type ExportStage } from '../data/inactive-export-stage';
import { InactiveNoticeFlow } from '../data/inactive-notice.flow';

const EXPORT_ITEM: ActionMenuItem = { key: 'export', labelKey: 'inactive.action.export' };
const OPEN_ITEM: ActionMenuItem = { key: 'open', labelKey: 'inactive.action.open' };

const LIMIT = 20;
const DEBOUNCE_MS = 350;

const COLUMNS: readonly DataColumn[] = [
  { key: 'org', labelKey: 'inactive.col.org', width: 'minmax(0, 1.6fr)' },
  { key: 'state', labelKey: 'inactive.col.state', width: '130px' },
  { key: 'last', labelKey: 'inactive.col.last', width: '160px' },
  { key: 'signed', labelKey: 'inactive.col.signed', width: '150px' },
  { key: 'plan', labelKey: 'inactive.col.plan', width: '170px' },
  { key: 'notice', labelKey: 'inactive.col.notice', width: '230px' },
  { key: 'export', labelKey: 'inactive.col.export', width: '140px' },
  { key: 'email', labelKey: 'inactive.col.email', width: 'minmax(0, 1fr)' },
  { key: 'actions', width: '48px', align: 'end' },
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
    ActionMenuComponent,
    InactiveExportDialogComponent,
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
          minWidth="1430px"
          [total]="total()"
          [from]="from()"
          [to]="to()"
          [page]="pageNumber()"
          [pageCount]="pageCount()"
          (pageChange)="goPage($event)"
        >
          @for (row of rows(); track row.organization.id) {
            <div
              class="dba-tr inactive__row"
              tabindex="0"
              (click)="open(row)"
              (keydown.enter)="open(row)"
            >
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
                @if (row.lastNotice; as notice) {
                  <span class="cell__label">{{
                    (notice.count > 1 ? 'inactive.noticeCell.sentMany' : 'inactive.noticeCell.sent')
                      | translate: { date: day(notice.sentAt), n: notice.count }
                  }}</span>
                  <span class="cell__meta">{{
                    'inactive.noticeCell.meta' | translate: { date: day(notice.deletionDate) }
                  }}</span>
                } @else {
                  <span class="dba-meta">{{ 'inactive.noticeCell.none' | translate }}</span>
                }
              </span>
              <span class="dba-td cell">
                @switch (exportStage(row)) {
                  @case ('none') {
                    <span class="dba-meta">{{ 'inactive.exportCell.none' | translate }}</span>
                  }
                  @case ('ready') {
                    <span class="cell__label">{{ 'inactive.exportCell.ready' | translate }}</span>
                    <span class="cell__meta">{{
                      'inactive.exportCell.readyMeta'
                        | translate: { date: day(row.lastExport?.expiresAt) }
                    }}</span>
                  }
                  @case ('expired') {
                    <span class="cell__label cell__label--plain">{{
                      'inactive.exportCell.expired' | translate
                    }}</span>
                    <span class="cell__meta">{{
                      'inactive.exportCell.expiredMeta'
                        | translate: { date: day(row.lastExport?.expiresAt) }
                    }}</span>
                  }
                  @case ('running') {
                    <span class="cell__label">{{ 'inactive.exportCell.running' | translate }}</span>
                  }
                  @case ('failed') {
                    <span class="cell__label cell__label--warn">{{
                      'inactive.exportCell.failed' | translate
                    }}</span>
                  }
                }
              </span>
              <span class="dba-td cell">
                <span class="cell__label cell__label--plain">{{
                  row.organization.email || '—'
                }}</span>
              </span>
              <span class="dba-td dba-td--end">
                <button
                  type="button"
                  class="inactive__more"
                  [attr.aria-label]="
                    'inactive.action.for' | translate: { name: row.organization.businessName }
                  "
                  (click)="openMenu($event, row)"
                  (keydown.enter)="$event.stopPropagation()"
                >
                  <db-icon name="moreVertical" [size]="16" />
                </button>
              </span>
            </div>
          }
        </dba-data-table>
      }
    </section>

    <dba-action-menu
      #actions
      label="inactive.action.label"
      [heading]="acting()?.organization?.businessName ?? ''"
      [items]="actionItems()"
      (picked)="onAction($event)"
    />

    @if (exporting(); as row) {
      <dba-inactive-export-dialog
        [organizationId]="row.organization.id"
        [orgName]="row.organization.businessName"
        [canManage]="canManage()"
        (closed)="exporting.set(null)"
      />
    }
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

    .inactive__row {
      cursor: pointer;
    }

    .inactive__more {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: var(--dba-radius-control);
      background: transparent;
      color: var(--dba-text-muted);
      cursor: pointer;
    }

    .inactive__more:hover {
      background: var(--dba-surface-hover);
      color: var(--dba-ink);
    }

    .inactive__more:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px var(--dba-focus-halo);
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

    .cell__meta--warn,
    .cell__label--warn {
      color: var(--dba-state-suspended-fg);
    }
  `,
})
export class InactiveClientsComponent {
  private readonly api = inject(InactiveClientsApi);
  private readonly notices = inject(InactiveNoticeFlow);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly canManage = computed(() => this.auth.canManage('clients'));
  protected readonly acting = signal<InactiveOrganizationRow | null>(null);
  protected readonly actionItems = computed<ActionMenuItem[]>(() => {
    const row = this.acting();
    if (!row || !this.canManage()) return [EXPORT_ITEM, OPEN_ITEM];
    const reachable = !!row.organization.email;
    const notice: ActionMenuItem = {
      key: 'notice',
      labelKey: 'inactive.action.notice',
      disabled: !reachable,
      ...(reachable ? {} : { hintKey: 'inactive.action.noEmail' }),
    };
    return [EXPORT_ITEM, notice, OPEN_ITEM];
  });
  protected readonly exporting = signal<InactiveOrganizationRow | null>(null);
  private readonly menu = viewChild.required<ActionMenuComponent>('actions');

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

  protected openMenu(event: Event, row: InactiveOrganizationRow): void {
    event.stopPropagation();
    this.acting.set(row);
    this.menu().toggle(event);
  }

  protected onAction(key: string): void {
    const row = this.acting();
    if (!row) return;
    if (key === 'export') this.exporting.set(row);
    if (key === 'notice') void this.sendNotice(row);
    if (key === 'open') this.open(row);
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

  protected day(value: DateInput): string {
    return safeDate(value, 'd/MM/y', this.locale);
  }

  protected exportStage(row: InactiveOrganizationRow): ExportStage {
    return rowExportStageOf(row.lastExport);
  }

  private async sendNotice(row: InactiveOrganizationRow): Promise<void> {
    if (await this.notices.send(row)) await this.reload();
  }

  private label(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}

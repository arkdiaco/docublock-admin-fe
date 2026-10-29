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
import { errorCodeOf, errorMessageOf } from '../../../../shared/http/error-code';
import { LatestRequest } from '../../../../shared/http/latest-request';
import { ButtonComponent } from '../../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state.component';
import { SectionLoaderComponent } from '../../../../shared/ui/section-loader.component';
import { StatBandComponent, type StatCell } from '../../../../shared/ui/stat-band.component';
import type { PlatformOrgDetail } from '../../data/organizations.models';
import { quotaRows, transferable } from '../../data/quota-rows';
import { QuotasApi } from '../../data/quotas.api';
import type {
  AssignQuotaBody,
  QuotaHistoryEntry,
  QuotaRow,
  QuotaTree,
  TransferQuotaBody,
} from '../../data/quotas.models';
import { AssignQuotaFormComponent } from './assign-quota-form.component';
import { TransferQuotaFormComponent } from './transfer-quota-form.component';

const HISTORY_LIMIT = 20;

const TREE_COLUMNS: readonly DataColumn[] = [
  { key: 'name', labelKey: 'quota.col.branch', width: 'minmax(220px, 2fr)' },
  { key: 'assigned', labelKey: 'quota.col.assigned', width: '100px', align: 'end' },
  { key: 'consumed', labelKey: 'quota.col.consumed', width: '100px', align: 'end' },
  { key: 'available', labelKey: 'quota.col.available', width: '100px', align: 'end' },
  { key: 'actions', width: '170px', align: 'end' },
];

const HISTORY_COLUMNS: readonly DataColumn[] = [
  { key: 'when', labelKey: 'quota.col.when', width: '130px' },
  { key: 'action', labelKey: 'quota.col.action', width: '120px' },
  { key: 'detail', labelKey: 'quota.col.detail', width: 'minmax(0, 2fr)' },
  { key: 'amount', labelKey: 'quota.col.amount', width: '90px', align: 'end' },
  { key: 'actor', labelKey: 'quota.col.actor', width: 'minmax(0, 1fr)' },
];

const KNOWN_ERRORS = [
  'CUOTA_BAJO_MINIMO',
  'CUOTA_INSUFICIENTE',
  'CUOTA_CONCURRENTE',
  'SUPERA_AL_PADRE',
  'SUPERA_EL_PLAN',
  'TIPOS_DISTINTOS',
  'MISMO_DESTINO',
];

type Open = { kind: 'assign'; row: QuotaRow } | { kind: 'transfer'; row: QuotaRow } | null;

@Component({
  selector: 'dba-quotas-tab',
  imports: [
    TranslatePipe,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    SectionLoaderComponent,
    StatBandComponent,
    AssignQuotaFormComponent,
    TransferQuotaFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'quota.loading' | translate" />
    } @else if (error()) {
      <div class="qt__panel">
        <dba-empty-state titleKey="quota.errorTitle" leadKey="quota.errorLead" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (tree(); as data) {
      <div class="qt">
        <section class="qt__card">
          <header class="qt__head">
            <h2 class="dba-panel">{{ 'quota.pool' | translate }}</h2>
            @if (canManage() && rows().length > 0) {
              <button dba-button variant="destructive" [busy]="working()" (click)="reset()">
                {{ 'quota.reset.open' | translate }}
              </button>
            }
          </header>
          <db-stat-band [cells]="poolCells()" [label]="'quota.pool' | translate" />
        </section>

        <section class="qt__card">
          <h2 class="dba-panel">{{ 'quota.branches' | translate }}</h2>
          @if (rows().length === 0) {
            <p class="dba-body qt__muted">{{ 'quota.noBranches' | translate }}</p>
          } @else {
            <dba-data-table
              [columns]="treeColumns"
              [label]="'quota.branches' | translate"
              minWidth="720px"
            >
              @for (row of rows(); track row.id) {
                <div class="dba-tr">
                  <span class="dba-td qt__name" [style.padding-left.px]="row.depth * 20">
                    <span class="dba-eyebrow">{{
                      'quota.type.' + row.categoryType | translate
                    }}</span>
                    <span class="qt__label">{{ row.name }}</span>
                  </span>
                  <code class="dba-td dba-td--end qt__num">{{ row.quotaAssigned }}</code>
                  <code class="dba-td dba-td--end qt__num">{{ row.quotaConsumed }}</code>
                  <code class="dba-td dba-td--end qt__num">{{ row.quotaAvailable }}</code>
                  <span class="dba-td dba-td--end qt__actions">
                    @if (canManage()) {
                      <button
                        type="button"
                        class="qt__link"
                        (click)="open.set({ kind: 'assign', row })"
                      >
                        {{ 'quota.assign.open' | translate }}
                      </button>
                      @if (movable(row) > 0) {
                        <button
                          type="button"
                          class="qt__link"
                          (click)="open.set({ kind: 'transfer', row })"
                        >
                          {{ 'quota.transfer.open' | translate }}
                        </button>
                      }
                    }
                  </span>
                </div>
              }
            </dba-data-table>
          }
        </section>

        <section class="qt__card">
          <h2 class="dba-panel">{{ 'quota.history' | translate }}</h2>
          @if (history().length === 0) {
            <p class="dba-body qt__muted">{{ 'quota.noHistory' | translate }}</p>
          } @else {
            <dba-data-table
              [columns]="historyColumns"
              [label]="'quota.history' | translate"
              minWidth="720px"
              [total]="historyTotal()"
              [from]="historyFrom()"
              [to]="historyTo()"
              [page]="historyPage()"
              [pageCount]="historyPages()"
              (pageChange)="goHistory($event)"
            >
              @for (entry of history(); track entry.id) {
                <div class="dba-tr">
                  <span class="dba-td dba-mono qt__small">{{ when(entry) }}</span>
                  <span class="dba-td">{{ 'quota.action.' + entry.action | translate }}</span>
                  <span class="dba-td qt__detail">{{ detail(entry) }}</span>
                  <code class="dba-td dba-td--end qt__num">{{ entry.amount }}</code>
                  <span class="dba-td qt__small">{{
                    entry.actor?.names || entry.actor?.email || ('quota.noActor' | translate)
                  }}</span>
                </div>
              }
            </dba-data-table>
          }
        </section>
      </div>

      @switch (open()?.kind) {
        @case ('assign') {
          <dba-assign-quota-form
            [row]="openRow()!"
            [boundsText]="boundsText(openRow()!)"
            [busy]="working()"
            (submitted)="assign($event)"
            (dismissed)="open.set(null)"
          />
        }
        @case ('transfer') {
          <dba-transfer-quota-form
            [row]="openRow()!"
            [rows]="rows()"
            [globalLabel]="'quota.transfer.global' | translate"
            [typeLabel]="typeLabel"
            [busy]="working()"
            (submitted)="transfer($event)"
            (dismissed)="open.set(null)"
          />
        }
      }
    }
  `,
  styles: `
    .qt {
      display: flex;
      flex-direction: column;
      gap: var(--dba-grid-gap);
    }

    .qt__card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .qt__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .qt__muted {
      margin: 0;
      color: var(--dba-text-muted);
    }

    .qt__name {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .qt__label {
      overflow: hidden;
      font-size: var(--dba-text-cell);
      font-weight: 500;
      color: var(--dba-ink);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .qt__num {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-small);
      color: var(--dba-text);
    }

    .qt__small {
      font-size: var(--dba-text-small);
      color: var(--dba-text);
    }

    .qt__detail {
      overflow: hidden;
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .qt__actions {
      display: flex;
      justify-content: flex-end;
      gap: 14px;
    }

    .qt__link {
      padding: 0;
      border: 0;
      background: transparent;
      font: inherit;
      font-size: var(--dba-text-small);
      font-weight: 600;
      color: var(--dba-violet-600);
      cursor: pointer;
    }

    .qt__link:hover {
      text-decoration: underline;
    }

    .qt__link:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .qt__panel {
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
export class QuotasTabComponent {
  readonly org = input.required<PlatformOrgDetail>();

  private readonly api = inject(QuotasApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();
  private readonly orgId = computed(() => this.org().id);

  protected readonly treeColumns = TREE_COLUMNS;
  protected readonly historyColumns = HISTORY_COLUMNS;
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly working = signal(false);
  protected readonly tree = signal<QuotaTree | null>(null);
  protected readonly history = signal<QuotaHistoryEntry[]>([]);
  protected readonly historyTotal = signal(0);
  protected readonly historyPage = signal(1);
  protected readonly open = signal<Open>(null);
  protected readonly canManage = computed(() => this.auth.canManage('clients'));

  protected readonly rows = computed(() => {
    const tree = this.tree();
    return tree ? quotaRows(tree) : [];
  });

  protected readonly openRow = computed(() => this.open()?.row ?? null);
  protected readonly historyPages = computed(() =>
    Math.max(1, Math.ceil(this.historyTotal() / HISTORY_LIMIT)),
  );
  protected readonly historyFrom = computed(() =>
    this.historyTotal() === 0 ? 0 : (this.historyPage() - 1) * HISTORY_LIMIT + 1,
  );
  protected readonly historyTo = computed(() =>
    Math.min(this.historyTotal(), this.historyPage() * HISTORY_LIMIT),
  );

  protected readonly poolCells = computed<StatCell[]>(() => {
    const pool = this.tree()?.organization;
    if (!pool) return [];
    const t = (key: string) => this.translate.instant(key) as string;
    const count = (value: number | null) => (value === null ? '∞' : String(value));
    return [
      {
        key: 'plan',
        label: t('quota.stat.plan'),
        value: count(pool.totalPlanDocuments),
        note: pool.subscribed ? undefined : t('quota.stat.noPlan'),
      },
      { key: 'remaining', label: t('quota.stat.remaining'), value: count(pool.remainingDocuments) },
      {
        key: 'assigned',
        label: t('quota.stat.assigned'),
        value: String(pool.totalAssignedToCategories),
      },
      { key: 'free', label: t('quota.stat.free'), value: count(pool.unassignedPool) },
    ];
  });

  protected readonly movable = transferable;

  protected readonly typeLabel = (row: QuotaRow): string =>
    this.translate.instant(`quota.type.${row.categoryType}`) as string;

  constructor() {
    effect(() => {
      if (this.orgId()) untracked(() => void this.reload());
    });
  }

  protected when(entry: QuotaHistoryEntry): string {
    return entry.createdAt ? formatDate(entry.createdAt, 'd/MM/y HH:mm', this.locale) : '—';
  }

  protected detail(entry: QuotaHistoryEntry): string {
    const route = [entry.sourceCategoryName, entry.destCategoryName].filter(Boolean).join(' → ');
    const change =
      entry.previousValue !== undefined && entry.newValue !== undefined
        ? ` · ${entry.previousValue} → ${entry.newValue}`
        : '';
    return `${route || '—'}${change}`;
  }

  protected boundsText(row: QuotaRow): string {
    return this.translate.instant(
      row.maxQuota === null ? 'quota.assign.boundsOpen' : 'quota.assign.bounds',
      {
        min: row.minQuota,
        max: row.maxQuota,
      },
    ) as string;
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(this.tree() === null);
    this.error.set(false);
    try {
      const [tree, history] = await Promise.all([
        firstValueFrom(this.api.tree(this.orgId())),
        firstValueFrom(this.api.history(this.orgId(), this.historyPage(), HISTORY_LIMIT)),
      ]);
      if (!current()) return;
      this.tree.set(tree);
      this.history.set(history.items);
      this.historyTotal.set(history.total);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  protected goHistory(page: number): void {
    this.historyPage.set(page);
    void this.reload();
  }

  protected async assign(body: AssignQuotaBody): Promise<void> {
    if (await this.run(this.api.assign(this.orgId(), body))) this.done('quota.done.assign');
  }

  protected async transfer(body: TransferQuotaBody): Promise<void> {
    if (await this.run(this.api.transfer(this.orgId(), body))) this.done('quota.done.transfer');
  }

  protected async reset(): Promise<void> {
    const org = this.org();
    const answer = await this.dialogs.open({
      intent: 'danger',
      icon: 'rotate',
      title: 'quota.reset.title',
      message: 'quota.reset.message',
      params: { name: org.businessName },
      confirmLabel: 'quota.reset.confirm',
      reason: {
        labelKey: 'sub.reasonLabel',
        placeholder: 'sub.reasonPlaceholder',
        limit: 500,
        quick: [],
        required: true,
      },
      challenge: { identifier: org.tributaryNumber, actionKey: 'quota.reset.verb' },
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    const result = await this.run(this.api.reset(org.id, answer.reason));
    if (result) {
      this.notify.success(
        this.translate.instant('quota.done.reset', {
          count: (result as { consumedBefore: number }).consumedBefore,
        }) as string,
      );
    }
  }

  private done(key: string): void {
    this.notify.success(this.translate.instant(key) as string);
  }

  private async run(request: Observable<unknown>): Promise<unknown> {
    this.working.set(true);
    try {
      const result = await firstValueFrom(request);
      this.open.set(null);
      this.historyPage.set(1);
      await this.reload();
      return result ?? true;
    } catch (error) {
      const code = errorCodeOf(error);
      const message = code && KNOWN_ERRORS.includes(code) ? errorMessageOf(error) : null;
      this.notify.error(message ?? (this.translate.instant('quota.error.generic') as string));
      return null;
    } finally {
      this.working.set(false);
    }
  }
}

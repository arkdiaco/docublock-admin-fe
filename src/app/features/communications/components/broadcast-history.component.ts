import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { DensityService } from '../../../core/preferences/density.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { LatestRequest } from '../../../shared/http/latest-request';
import { safeDate } from '../../../shared/i18n/safe-date';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { BroadcastsApi, withdrawErrorKey } from '../data/broadcasts.api';
import { broadcastsPageOf, type BroadcastView } from '../data/broadcasts.models';

const LIMIT = 20;

const COLUMNS: readonly DataColumn[] = [
  { key: 'date', labelKey: 'comm.live.history.col.date', width: '150px' },
  { key: 'message', labelKey: 'comm.live.history.col.message', width: 'minmax(0, 2fr)' },
  { key: 'by', labelKey: 'comm.live.history.col.by', width: 'minmax(0, 1fr)' },
  { key: 'state', labelKey: 'comm.live.history.col.state', width: 'minmax(0, 1.2fr)' },
  { key: 'action', labelKey: 'comm.live.history.col.action', width: '120px', align: 'end' },
];

@Component({
  selector: 'dba-broadcast-history',
  imports: [
    TranslatePipe,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    ModalShellComponent,
    OrgStateComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="step">
      <h2 class="dba-panel">{{ 'comm.live.history.title' | translate }}</h2>
      @if (loading()) {
        <db-section-loader [label]="'comm.live.history.loading' | translate" />
      } @else if (error()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="comm.live.history.errorTitle" leadKey="comm.errorLead" />
          <button dba-button variant="secondary" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (items().length === 0) {
        <div class="bl__panel">
          <dba-empty-state titleKey="comm.live.history.emptyTitle" leadKey="comm.live.history.emptyLead" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'comm.live.history.title' | translate"
          [dense]="density.compact()"
          minWidth="900px"
          [total]="total()"
          [from]="(page() - 1) * limit + 1"
          [to]="rangeTo()"
          [page]="page()"
          [pageCount]="pageCount()"
          (pageChange)="goPage($event)"
        >
          @for (row of items(); track row.id) {
            <div class="dba-tr">
              <span class="dba-td cell"><span class="cell__muted dba-mono">{{ when(row.createdAt) }}</span></span>
              <span class="dba-td cell">
                <span class="cell__label">{{ row.title }}</span>
                <span class="cell__muted">{{ row.message }}</span>
              </span>
              <span class="dba-td cell"><span class="cell__muted">{{ row.createdByName || '—' }}</span></span>
              <span class="dba-td cell">
                @if (row.state === 'active') {
                  <dba-org-state state="active" labelKey="comm.live.state.active" variant="inline" />
                } @else {
                  <dba-org-state state="closed" labelKey="comm.live.state.withdrawn" variant="inline" />
                  <span class="cell__meta">
                    {{ 'comm.live.history.withdrawnBy' | translate: { name: row.withdrawnByName || '—', date: when(row.withdrawnAt) } }}
                  </span>
                }
              </span>
              <span class="dba-td cell cell--end">
                @if (canManage() && row.state === 'active') {
                  <button dba-button variant="secondary" (click)="target.set(row)">
                    {{ 'comm.live.withdraw.action' | translate }}
                  </button>
                }
              </span>
            </div>
          }
        </dba-data-table>
      }
    </section>

    @if (target(); as row) {
      <db-modal-shell
        icon="bell"
        [title]="'comm.live.withdraw.title' | translate"
        [subtitle]="row.title"
        confirmLabel="comm.live.withdraw.confirm"
        [busy]="withdrawing()"
        [maxWidth]="480"
        (confirmed)="withdraw(row)"
        (dismissed)="dismiss()"
      >
        <p class="notice" role="note">{{ 'comm.live.withdraw.notice' | translate }}</p>
      </db-modal-shell>
    }
  `,
  styleUrls: ['../../../shared/ui/list-page.scss', '../../../shared/ui/confirm-notice.scss'],
  styles: `
    .step {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-top: 28px;
    }

    .cell--end {
      align-items: flex-end;
      justify-content: center;
    }
  `,
})
export class BroadcastHistoryComponent {
  readonly refresh = input(0);

  private readonly api = inject(BroadcastsApi);
  private readonly auth = inject(AuthStore);
  private readonly locale = inject(LOCALE_ID);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly limit = LIMIT;
  protected readonly canManage = computed(() => this.auth.canManage('catalogs'));
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly items = signal<BroadcastView[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly target = signal<BroadcastView | null>(null);
  protected readonly withdrawing = signal(false);
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly rangeTo = computed(() => Math.min(this.total(), this.page() * LIMIT));

  constructor() {
    effect(() => {
      this.refresh();
      untracked(() => {
        this.page.set(1);
        void this.reload();
      });
    });
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.reload();
  }

  protected when(value?: string): string {
    return value ? safeDate(value, 'd/MM/y, HH:mm', this.locale) : '—';
  }

  protected dismiss(): void {
    if (!this.withdrawing()) this.target.set(null);
  }

  protected async withdraw(row: BroadcastView): Promise<void> {
    if (this.withdrawing()) return;
    this.withdrawing.set(true);
    try {
      await firstValueFrom(this.api.withdraw(row.id));
      this.notify.success(this.label('comm.live.withdraw.done'));
    } catch (error) {
      this.notify.error(this.label(withdrawErrorKey(error)));
    } finally {
      this.withdrawing.set(false);
      this.target.set(null);
      void this.reload();
    }
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const result = broadcastsPageOf(await firstValueFrom(this.api.list({ page: this.page(), limit: LIMIT })));
      if (!current()) return;
      this.items.set(result.items);
      this.total.set(result.total);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  private label(key: string): string {
    return this.translate.instant(key) as string;
  }
}

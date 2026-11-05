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
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FilterPillsComponent } from '../../../shared/ui/filter-pills.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { QueueItemDetailComponent } from '../components/queue-item-detail.component';
import { QueueRetryConfirmComponent } from '../components/queue-retry-confirm.component';
import { hasError, hasOrganization, hasRetries, isQueueKey, kindKeyOf, statePills } from '../data/queue-view';
import { TasksApi, retryErrorKey } from '../data/tasks.api';
import type { QueueCounts, QueueItem, QueueKey, QueueState } from '../data/tasks.models';

const LIMIT = 20;

@Component({
  selector: 'dba-queue-detail',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    FilterPillsComponent,
    IconComponent,
    QueueItemDetailComponent,
    QueueRetryConfirmComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (queueKey(); as key) {
      <section class="bl">
        <header class="bl__head">
          <div class="bl__title">
            <h1 class="dba-page">{{ 'task.queue.' + key + '.name' | translate }}</h1>
            <span class="dba-meta">{{ 'task.queue.' + key + '.lead' | translate }}</span>
          </div>
          <div class="heading-actions">
            <button dba-button variant="secondary" [disabled]="refreshing()" (click)="load(false)">
              {{ 'task.refresh' | translate }}
            </button>
            <a dba-button variant="secondary" [routerLink]="[path]">{{ 'task.back' | translate }}</a>
          </div>
        </header>

        @if (counts(); as current) {
          <div class="bl__tools">
            <db-filter-pills
              [pills]="pills()"
              [active]="state() ?? ''"
              [label]="'task.col.state' | translate"
              (activeChange)="pick($event)"
            />
          </div>
        }

        @if (loading()) {
          <db-section-loader [label]="'task.loading' | translate" />
        } @else if (error()) {
          <div class="bl__panel">
            <dba-empty-state titleKey="task.errorTitle" leadKey="task.errorLead" />
            <button dba-button variant="secondary" (click)="load(true)">
              {{ 'common.retry' | translate }}
            </button>
          </div>
        } @else if (items().length === 0) {
          <div class="bl__panel">
            <dba-empty-state [titleKey]="'task.empty.' + (state() ?? 'pending')" />
          </div>
        } @else {
          <dba-data-table
            [columns]="columns()"
            [label]="'task.queue.' + key + '.name' | translate"
            [dense]="density.compact()"
            [minWidth]="withRetries() ? '960px' : '720px'"
            [total]="total()"
            [from]="(page() - 1) * limit + 1"
            [to]="rangeTo()"
            [page]="page()"
            [pageCount]="pageCount()"
            (pageChange)="goPage($event)"
          >
            @for (row of items(); track row.id) {
              <button type="button" class="dba-tr bl-row" (click)="selected.set(row)">
                @if (withOrganization()) {
                  <span class="dba-td cell">
                    <span class="cell__label">{{ row.organization?.name || '—' }}</span>
                  </span>
                }
                <span class="dba-td cell"><span class="cell__text">{{ describe(row) }}</span></span>
                @if (withRetries()) {
                  <span class="dba-td cell cell--end dba-mono">{{ row.attempts ?? 0 }}</span>
                  <span class="dba-td cell"><span class="cell__muted dba-mono">{{ when(row.nextAt) }}</span></span>
                }
                <span class="dba-td cell"><span class="cell__muted dba-mono">{{ when(row.createdAt) }}</span></span>
                @if (withError()) {
                  <span class="dba-td cell"><span class="cell__muted">{{ row.error || '—' }}</span></span>
                }
                <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
              </button>
            }
          </dba-data-table>
        }
      </section>

      @if (selected(); as item) {
        @if (retrying()) {
          <dba-queue-retry-confirm
            [queue]="key"
            [item]="item"
            [busy]="pending.key() === 'retry'"
            (submitted)="retry(key, item, $event)"
            (dismissed)="retrying.set(false)"
          />
        } @else {
          <dba-queue-item-detail
            [queue]="key"
            [item]="item"
            (retry)="retrying.set(true)"
            (dismissed)="selected.set(null)"
          />
        }
      }
    } @else {
      <div class="bl__panel">
        <dba-empty-state titleKey="task.missingTitle" leadKey="task.missingLead" />
        <a dba-button variant="secondary" [routerLink]="[path]">{{ 'task.back' | translate }}</a>
      </div>
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
  styles: `
    .cell--end {
      justify-content: flex-end;
      text-align: end;
    }

    .heading-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `,
})
export class QueueDetailComponent {
  readonly queue = input.required<string>();

  private readonly api = inject(TasksApi);
  private readonly locale = inject(LOCALE_ID);
  private readonly translate = inject(TranslateService);
  private readonly notify = inject(NotificationService);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly path = sectionPath('tasks');
  protected readonly limit = LIMIT;
  protected readonly queueKey = computed((): QueueKey | null => {
    const value = this.queue();
    return isQueueKey(value) ? value : null;
  });
  protected readonly withOrganization = computed(() => this.has(hasOrganization));
  protected readonly withRetries = computed(() => this.has(hasRetries));
  protected readonly withError = computed(() => this.has(hasError));
  protected readonly columns = computed((): DataColumn[] => [
    ...(this.withOrganization()
      ? [{ key: 'organization', labelKey: 'task.col.organization', width: 'minmax(0, 1.2fr)' }]
      : []),
    { key: 'item', labelKey: 'task.col.item', width: 'minmax(0, 1.4fr)' },
    ...(this.withRetries()
      ? [
          { key: 'attempts', labelKey: 'task.col.attempts', width: '80px', align: 'end' as const },
          { key: 'next', labelKey: 'task.col.next', width: '170px' },
        ]
      : []),
    { key: 'created', labelKey: 'task.col.created', width: '170px' },
    ...(this.withError() ? [{ key: 'error', labelKey: 'task.col.error', width: 'minmax(0, 1.6fr)' }] : []),
    { key: 'chevron', width: '24px', align: 'end' as const },
  ]);
  protected readonly loading = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly error = signal(false);
  protected readonly state = signal<QueueState | null>(null);
  protected readonly counts = signal<QueueCounts | null>(null);
  protected readonly pills = computed(() => {
    const counts = this.counts();
    return counts ? statePills(counts) : [];
  });
  protected readonly items = signal<QueueItem[]>([]);
  protected readonly selected = signal<QueueItem | null>(null);
  protected readonly retrying = signal(false);
  protected readonly pending = new PendingAction();
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly rangeTo = computed(() => Math.min(this.total(), this.page() * LIMIT));

  constructor() {
    effect(() => {
      this.queueKey();
      untracked(() => {
        this.state.set(null);
        this.counts.set(null);
        this.page.set(1);
        void this.load(true);
      });
    });
  }

  protected pick(key: string): void {
    this.state.set(key as QueueState);
    this.page.set(1);
    void this.load(true);
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.load(true);
  }

  protected describe(row: QueueItem): string {
    const key = row.kind ? kindKeyOf(row.kind) : null;
    const kind = key ? (this.translate.instant(key) as string) : row.kind;
    return [kind, row.label].filter(Boolean).join(' · ') || '—';
  }

  protected when(value: string | null): string {
    return value ? formatDate(value, 'd/MM/y, HH:mm', this.locale) : '—';
  }

  protected async retry(queue: QueueKey, item: QueueItem, reason: string): Promise<void> {
    if (this.pending.key()) return;
    await this.pending.run('retry', async () => {
      try {
        await firstValueFrom(this.api.retry(queue, item.id, reason));
        this.notify.success(this.translate.instant('task.retry.started') as string);
      } catch (error) {
        this.notify.error(this.translate.instant(retryErrorKey(error)) as string);
      }
      this.retrying.set(false);
      this.selected.set(null);
      await this.load(false);
    });
  }

  protected async load(withLoader: boolean): Promise<void> {
    const key = this.queueKey();
    if (!key) return;
    const current = this.latest.start();
    if (withLoader) {
      this.loading.set(true);
      this.error.set(false);
    } else {
      this.refreshing.set(true);
    }
    const state = this.state();
    try {
      const result = await firstValueFrom(
        this.api.items(key, {
          ...(state ? { state } : {}),
          page: this.page(),
          limit: LIMIT,
        }),
      );
      if (!current()) return;
      this.state.set(result.state);
      this.counts.set(result.counts);
      this.items.set(result.items);
      this.total.set(result.total);
      this.error.set(false);
      if (result.items.length === 0 && result.total > 0) {
        this.page.set(this.pageCount());
        await this.load(false);
      }
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) {
        this.loading.set(false);
        this.refreshing.set(false);
      }
    }
  }

  private has(check: (queue: QueueKey) => boolean): boolean {
    const key = this.queueKey();
    return key ? check(key) : false;
  }
}

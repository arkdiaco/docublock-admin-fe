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
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { LatestRequest } from '../http/latest-request';
import { AuditEventComponent } from './audit-event.component';
import { ButtonComponent } from './button.component';
import { EmptyStateComponent } from './empty-state.component';
import { SectionLoaderComponent } from './section-loader.component';

export interface TargetHistoryEvent {
  id: string;
  action: string;
  admin: { id: string; email?: string; name?: string };
  organization?: { id: string; name?: string };
  reason?: string;
  createdAt?: string;
}

export type TargetHistoryLoader = (
  page: number,
  limit: number,
) => Observable<{ total: number; items: TargetHistoryEvent[] }>;

const LIMIT = 20;

@Component({
  selector: 'dba-target-history',
  imports: [
    TranslatePipe,
    AuditEventComponent,
    ButtonComponent,
    EmptyStateComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'hist.loading' | translate" />
    } @else if (error()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="hist.errorTitle" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (items().length === 0) {
      <div class="bd__panel">
        <dba-empty-state titleKey="hist.emptyTitle" leadKey="hist.emptyLead" />
      </div>
    } @else {
      <section class="bd__card">
        <p class="dba-meta">
          {{ 'hist.count' | translate: { shown: items().length, total: total() } }}
        </p>
        <div class="uh__events">
          @for (row of items(); track row.id; let last = $last) {
            <dba-audit-event
              [actor]="actorOf(row)"
              [meta]="metaOf(row)"
              [last]="last && !hasMore()"
            >
              <span class="uh__what">
                <span>{{
                  'act.' + row.action
                    | translate: { org: row.organization?.name || ('hist.anyOrg' | translate) }
                }}</span>
                @if (row.reason) {
                  <span class="uh__reason">«{{ row.reason }}»</span>
                }
              </span>
            </dba-audit-event>
          }
        </div>
        @if (hasMore()) {
          <button dba-button variant="secondary" [busy]="loadingMore()" (click)="more()">
            {{ 'hist.more' | translate }}
          </button>
        }
      </section>
    }
  `,
  styles: `
    .uh__events {
      display: flex;
      flex-direction: column;
    }

    .uh__what {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4px 8px;
      margin-left: 8px;
    }

    .uh__reason {
      color: var(--dba-text-muted);
      overflow-wrap: anywhere;
    }
  `,
  styleUrl: './detail-page.scss',
})
export class TargetHistoryComponent {
  readonly load = input.required<TargetHistoryLoader>();

  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly error = signal(false);
  protected readonly items = signal<TargetHistoryEvent[]>([]);
  protected readonly total = signal(0);
  private readonly page = signal(1);
  protected readonly hasMore = computed(() => this.items().length < this.total());

  constructor() {
    effect(() => {
      this.load();
      untracked(() => void this.reload());
    });
  }

  protected actorOf(row: TargetHistoryEvent): string {
    return row.admin.name || row.admin.email || row.admin.id;
  }

  protected metaOf(row: TargetHistoryEvent): string {
    return row.createdAt
      ? `${formatDate(row.createdAt, 'd/MM/y HH:mm', this.locale, 'UTC')} UTC`
      : '';
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    this.page.set(1);
    try {
      const page = await firstValueFrom(this.load()(1, LIMIT));
      if (!current()) return;
      this.items.set(page.items);
      this.total.set(page.total);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  protected async more(): Promise<void> {
    const current = this.latest.start();
    this.loadingMore.set(true);
    try {
      const next = this.page() + 1;
      const page = await firstValueFrom(this.load()(next, LIMIT));
      if (!current()) return;
      this.items.update((items) => [...items, ...page.items]);
      this.total.set(page.total);
      this.page.set(next);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loadingMore.set(false);
    }
  }
}

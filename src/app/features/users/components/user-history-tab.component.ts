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
import { firstValueFrom } from 'rxjs';
import { LatestRequest } from '../../../shared/http/latest-request';
import { AuditEventComponent } from '../../../shared/ui/audit-event.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { UsersApi } from '../data/users.api';
import type { UserHistoryEvent } from '../data/users.models';

const LIMIT = 20;

@Component({
  selector: 'dba-user-history-tab',
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
      <db-section-loader [label]="'usr.history.loading' | translate" />
    } @else if (error()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="usr.history.errorTitle" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (items().length === 0) {
      <div class="bd__panel">
        <dba-empty-state titleKey="usr.history.emptyTitle" leadKey="usr.history.emptyLead" />
      </div>
    } @else {
      <section class="bd__card">
        <p class="dba-meta">
          {{ 'usr.history.count' | translate: { shown: items().length, total: total() } }}
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
                    | translate: { org: row.organization?.name || ('usr.anyOrg' | translate) }
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
            {{ 'usr.history.more' | translate }}
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
  styleUrl: '../../../shared/ui/detail-page.scss',
})
export class UserHistoryTabComponent {
  readonly userId = input.required<string>();

  private readonly api = inject(UsersApi);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly error = signal(false);
  protected readonly items = signal<UserHistoryEvent[]>([]);
  protected readonly total = signal(0);
  private readonly page = signal(1);
  protected readonly hasMore = computed(() => this.items().length < this.total());

  constructor() {
    effect(() => {
      this.userId();
      untracked(() => void this.reload());
    });
  }

  protected actorOf(row: UserHistoryEvent): string {
    return row.admin.name || row.admin.email || row.admin.id;
  }

  protected metaOf(row: UserHistoryEvent): string {
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
      const page = await firstValueFrom(this.api.history(this.userId(), 1, LIMIT));
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
      const page = await firstValueFrom(this.api.history(this.userId(), next, LIMIT));
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

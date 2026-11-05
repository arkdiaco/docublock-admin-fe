import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { TasksTabsComponent } from '../components/tasks-tabs.component';
import { TasksApi } from '../data/tasks.api';
import type { QueueSummary } from '../data/tasks.models';

const COLUMNS: readonly DataColumn[] = [
  { key: 'queue', labelKey: 'task.col.queue', width: 'minmax(0, 2.4fr)' },
  { key: 'failed', labelKey: 'task.state.failed', width: '80px', align: 'end' },
  { key: 'pending', labelKey: 'task.state.pending', width: '90px', align: 'end' },
  { key: 'running', labelKey: 'task.state.running', width: '80px', align: 'end' },
  { key: 'oldest', labelKey: 'task.col.oldest', width: '170px' },
  { key: 'chevron', width: '24px', align: 'end' },
];

@Component({
  selector: 'dba-tasks',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    IconComponent,
    SectionLoaderComponent,
    TasksTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.tasks' | translate }}</h1>
          <span class="dba-meta">{{ 'task.lead' | translate }}</span>
        </div>
        <button dba-button variant="secondary" [disabled]="refreshing()" (click)="refresh()">
          {{ 'task.refresh' | translate }}
        </button>
      </header>

      <dba-tasks-tabs active="queues" />

      @if (loading()) {
        <db-section-loader [label]="'task.loading' | translate" />
      } @else if (error()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="task.errorTitle" leadKey="task.errorLead" />
          <button dba-button variant="secondary" (click)="load(true)">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'nav.tasks' | translate"
          [dense]="density.compact()"
          minWidth="720px"
        >
          @for (queue of queues(); track queue.key) {
            <a class="dba-tr bl-row" [routerLink]="[path, queue.key]">
              <span class="dba-td cell">
                <span class="cell__label">{{ 'task.queue.' + queue.key + '.name' | translate }}</span>
                <span class="cell__muted">{{ 'task.queue.' + queue.key + '.lead' | translate }}</span>
              </span>
              <span class="dba-td cell cell--end dba-mono" [class.queue__failed]="(queue.counts.failed ?? 0) > 0">{{
                countOf(queue.counts.failed)
              }}</span>
              <span class="dba-td cell cell--end dba-mono">{{ countOf(queue.counts.pending) }}</span>
              <span class="dba-td cell cell--end dba-mono">{{ countOf(queue.counts.running) }}</span>
              <span class="dba-td cell"><span class="cell__muted dba-mono">{{ when(queue.oldestPendingAt) }}</span></span>
              <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
            </a>
          }
        </dba-data-table>
      }
    </section>
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
  styles: `
    .cell--end {
      justify-content: flex-end;
      text-align: end;
    }

    .queue__failed {
      color: var(--dba-state-suspended-fg);
      font-weight: 600;
    }
  `,
})
export class TasksComponent {
  private readonly api = inject(TasksApi);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly path = sectionPath('tasks');
  protected readonly loading = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly error = signal(false);
  protected readonly queues = signal<QueueSummary[]>([]);

  constructor() {
    void this.load(true);
  }

  protected countOf(value: number | null): string {
    return value === null ? '—' : String(value);
  }

  protected when(value: string | null): string {
    return value ? formatDate(value, 'd/MM/y, HH:mm', this.locale) : '—';
  }

  protected refresh(): void {
    void this.load(false);
  }

  protected async load(withLoader: boolean): Promise<void> {
    const current = this.latest.start();
    if (withLoader) {
      this.loading.set(true);
      this.error.set(false);
    } else {
      this.refreshing.set(true);
    }
    try {
      const { queues } = await firstValueFrom(this.api.queues());
      if (!current()) return;
      this.queues.set(queues);
      this.error.set(false);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) {
        this.loading.set(false);
        this.refreshing.set(false);
      }
    }
  }
}

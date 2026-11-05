import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { DensityService } from '../../../core/preferences/density.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { PendingAction } from '../../../shared/domain/pending-action';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { MaintenanceDetailComponent } from '../components/maintenance-detail.component';
import { MaintenanceExecuteConfirmComponent } from '../components/maintenance-execute-confirm.component';
import { MaintenanceRunDetailComponent } from '../components/maintenance-run-detail.component';
import { TasksTabsComponent } from '../components/tasks-tabs.component';
import { runRowsKey, runStateOf, taskStateOf, type MaintenanceStateView } from '../data/maintenance-view';
import { TasksApi, maintenanceErrorKey } from '../data/tasks.api';
import type { MaintenanceRun, MaintenanceTaskKey, MaintenanceTaskView } from '../data/tasks.models';

const TASK_COLUMNS: readonly DataColumn[] = [
  { key: 'task', labelKey: 'task.mnt.col.task', width: 'minmax(0, 2.4fr)' },
  { key: 'rehearsal', labelKey: 'task.mnt.col.rehearsal', width: 'minmax(150px, 1fr)' },
  { key: 'execution', labelKey: 'task.mnt.col.execution', width: 'minmax(150px, 1fr)' },
  { key: 'state', labelKey: 'task.mnt.col.state', width: '140px' },
  { key: 'chevron', width: '24px', align: 'end' },
];

const RUN_COLUMNS: readonly DataColumn[] = [
  { key: 'when', labelKey: 'task.mnt.history.col.when', width: '150px' },
  { key: 'task', labelKey: 'task.mnt.history.col.task', width: 'minmax(0, 1.6fr)' },
  { key: 'mode', labelKey: 'task.mnt.history.col.mode', width: '100px' },
  { key: 'result', labelKey: 'task.mnt.history.col.result', width: '130px' },
  { key: 'rows', labelKey: 'task.mnt.history.col.rows', width: '130px' },
  { key: 'who', labelKey: 'task.mnt.history.col.who', width: 'minmax(0, 1fr)' },
  { key: 'reason', labelKey: 'task.mnt.history.col.reason', width: 'minmax(0, 1.4fr)' },
  { key: 'chevron', width: '24px', align: 'end' },
];

const LIMIT = 20;

export const MAINTENANCE_POLL_MS = 3000;

@Component({
  selector: 'dba-maintenance',
  imports: [
    TranslatePipe,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    IconComponent,
    MaintenanceDetailComponent,
    MaintenanceExecuteConfirmComponent,
    MaintenanceRunDetailComponent,
    OrgStateComponent,
    SectionLoaderComponent,
    TasksTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.tasks' | translate }}</h1>
          <span class="dba-meta">{{ 'task.mnt.lead' | translate }}</span>
        </div>
        <button dba-button variant="secondary" [disabled]="refreshing()" (click)="refresh()">
          {{ 'task.refresh' | translate }}
        </button>
      </header>

      <dba-tasks-tabs active="maintenance" />

      @if (loading()) {
        <db-section-loader [label]="'task.mnt.loading' | translate" />
      } @else if (error()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="task.mnt.errorTitle" leadKey="task.errorLead" />
          <button dba-button variant="secondary" (click)="load(true)">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else {
        <dba-data-table
          [columns]="taskColumns"
          [label]="'task.tab.maintenance' | translate"
          [dense]="density.compact()"
          minWidth="820px"
        >
          @for (task of tasks(); track task.key) {
            <button type="button" class="dba-tr bl-row" (click)="selectedKey.set(task.key)">
              <span class="dba-td cell">
                <span class="cell__label">{{ 'task.mnt.' + task.key + '.name' | translate }}</span>
                <span class="cell__muted">{{ 'task.mnt.' + task.key + '.lead' | translate }}</span>
              </span>
              <span class="dba-td cell">
                @if (task.lastRehearsal; as run) {
                  <span class="cell__text dba-mono">{{ when(run.finishedAt ?? run.startedAt) }}</span>
                  <span class="cell__muted">{{ rowsOf(run) }}</span>
                } @else {
                  <span class="cell__muted">—</span>
                }
              </span>
              <span class="dba-td cell">
                @if (task.lastExecution; as run) {
                  <span class="cell__text dba-mono">{{ when(run.finishedAt ?? run.startedAt) }}</span>
                  <span class="cell__muted">{{ rowsOf(run) }}</span>
                } @else {
                  <span class="cell__muted">—</span>
                }
              </span>
              <span class="dba-td cell">
                <dba-org-state [state]="stateOf(task).state" [labelKey]="stateOf(task).labelKey" variant="inline" />
              </span>
              <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
            </button>
          }
        </dba-data-table>

        <h2 class="dba-panel">{{ 'task.mnt.history.title' | translate }}</h2>

        @if (runsError()) {
          <div class="bl__panel">
            <dba-empty-state titleKey="task.mnt.history.errorTitle" leadKey="task.errorLead" />
            <button dba-button variant="secondary" (click)="loadRuns()">
              {{ 'common.retry' | translate }}
            </button>
          </div>
        } @else if (runs().length === 0) {
          <div class="bl__panel">
            <dba-empty-state titleKey="task.mnt.history.empty" />
          </div>
        } @else {
          <dba-data-table
            [columns]="runColumns"
            [label]="'task.mnt.history.title' | translate"
            [dense]="density.compact()"
            minWidth="1040px"
            [total]="total()"
            [from]="(page() - 1) * limit + 1"
            [to]="rangeTo()"
            [page]="page()"
            [pageCount]="pageCount()"
            (pageChange)="goPage($event)"
          >
            @for (run of runs(); track run.id) {
              <button type="button" class="dba-tr bl-row" (click)="openRun(run.id)">
                <span class="dba-td cell"><span class="cell__muted dba-mono">{{ when(run.finishedAt ?? run.startedAt) }}</span></span>
                <span class="dba-td cell"><span class="cell__label">{{ 'task.mnt.' + run.task + '.name' | translate }}</span></span>
                <span class="dba-td cell"><span class="cell__text">{{ 'task.mnt.mode.' + run.mode | translate }}</span></span>
                <span class="dba-td cell">
                  <dba-org-state [state]="runState(run).state" [labelKey]="runState(run).labelKey" variant="inline" />
                </span>
                <span class="dba-td cell"><span class="cell__muted">{{ rowsOf(run) }}</span></span>
                <span class="dba-td cell"><span class="cell__text">{{ run.admin?.name || '—' }}</span></span>
                <span class="dba-td cell"><span class="cell__muted">{{ run.reason || '—' }}</span></span>
                <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
              </button>
            }
          </dba-data-table>
        }
      }
    </section>

    @if (selected(); as task) {
      @if (confirming()) {
        <dba-maintenance-execute-confirm
          [task]="task"
          [busy]="pending.key() === 'execute'"
          (submitted)="execute(task, $event)"
          (dismissed)="confirming.set(false)"
        />
      } @else {
        <dba-maintenance-detail
          [task]="task"
          [busy]="pending.key() === 'rehearse'"
          (rehearse)="rehearse(task.key)"
          (execute)="confirming.set(true)"
          (dismissed)="selectedKey.set(null)"
        />
      }
    }

    @if (openedRun(); as run) {
      <dba-maintenance-run-detail [run]="run" (dismissed)="openedRun.set(null)" />
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
})
export class MaintenanceComponent {
  private readonly api = inject(TasksApi);
  private readonly locale = inject(LOCALE_ID);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly latest = new LatestRequest();
  private readonly latestRuns = new LatestRequest();
  private readonly latestOpen = new LatestRequest();
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly density = inject(DensityService);
  protected readonly pending = new PendingAction();
  protected readonly taskColumns = TASK_COLUMNS;
  protected readonly runColumns = RUN_COLUMNS;
  protected readonly limit = LIMIT;
  protected readonly loading = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly error = signal(false);
  protected readonly tasks = signal<MaintenanceTaskView[]>([]);
  protected readonly selectedKey = signal<MaintenanceTaskKey | null>(null);
  protected readonly confirming = signal(false);
  protected readonly selected = computed(
    () => this.tasks().find((task) => task.key === this.selectedKey()) ?? null,
  );
  protected readonly runs = signal<MaintenanceRun[]>([]);
  protected readonly runsError = signal(false);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / LIMIT)));
  protected readonly rangeTo = computed(() => Math.min(this.total(), this.page() * LIMIT));
  protected readonly openedRun = signal<MaintenanceRun | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopPolling());
    void this.load(true);
  }

  protected stateOf(task: MaintenanceTaskView): MaintenanceStateView {
    return taskStateOf(task);
  }

  protected runState(run: MaintenanceRun): MaintenanceStateView {
    return runStateOf(run);
  }

  protected rowsOf(run: MaintenanceRun): string {
    if (run.state === 'running') return this.translate.instant('task.mnt.state.running') as string;
    const rows = runRowsKey(run);
    const text = this.translate.instant(rows.key, { count: rows.count }) as string;
    if (run.failed === 0) return text;
    return `${text} · ${this.translate.instant('task.mnt.rows.failed', { count: run.failed }) as string}`;
  }

  protected when(value: string): string {
    return formatDate(value, 'd/MM/y, HH:mm', this.locale);
  }

  protected refresh(): void {
    void this.load(false);
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.loadRuns();
  }

  protected async rehearse(key: MaintenanceTaskKey): Promise<void> {
    if (this.pending.key()) return;
    await this.pending.run('rehearse', async () => {
      try {
        await firstValueFrom(this.api.rehearse(key));
        this.notify.success(this.translate.instant('task.mnt.rehearse.started') as string);
      } catch (error) {
        this.notify.error(this.translate.instant(maintenanceErrorKey(error)) as string);
      }
      await this.load(false);
    });
  }

  protected async execute(task: MaintenanceTaskView, reason: string): Promise<void> {
    const rehearsalId = task.validRehearsalId;
    if (this.pending.key() || !rehearsalId) return;
    await this.pending.run('execute', async () => {
      try {
        await firstValueFrom(this.api.execute(task.key, reason, rehearsalId));
        this.notify.success(this.translate.instant('task.mnt.execute.started') as string);
      } catch (error) {
        this.notify.error(this.translate.instant(maintenanceErrorKey(error)) as string);
      }
      this.confirming.set(false);
      await this.load(false);
    });
  }

  protected async openRun(id: string): Promise<void> {
    const current = this.latestOpen.start();
    try {
      const run = await firstValueFrom(this.api.maintenanceRun(id));
      if (current()) this.openedRun.set(run);
    } catch {
      if (current()) this.notify.error(this.translate.instant('task.mnt.history.openFailed') as string);
    }
  }

  protected async load(withLoader: boolean): Promise<void> {
    const current = this.latest.start();
    this.stopPolling();
    if (withLoader) {
      this.loading.set(true);
      this.error.set(false);
    } else {
      this.refreshing.set(true);
    }
    try {
      const [{ tasks }] = await Promise.all([firstValueFrom(this.api.maintenanceTasks()), this.loadRuns()]);
      if (!current()) return;
      this.tasks.set(tasks);
      this.error.set(false);
      if (tasks.some((task) => task.running)) this.schedulePoll();
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) {
        this.loading.set(false);
        this.refreshing.set(false);
      }
    }
  }

  protected async loadRuns(): Promise<void> {
    const current = this.latestRuns.start();
    try {
      const { total, items } = await firstValueFrom(this.api.maintenanceRuns({ page: this.page(), limit: LIMIT }));
      if (!current()) return;
      this.total.set(total);
      this.runs.set(items);
      this.runsError.set(false);
    } catch {
      if (current()) this.runsError.set(true);
    }
  }

  private schedulePoll(): void {
    this.pollTimer = setTimeout(() => void this.load(false), MAINTENANCE_POLL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }
}

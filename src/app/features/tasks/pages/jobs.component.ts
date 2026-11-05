import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { DensityService } from '../../../core/preferences/density.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { LatestRequest } from '../../../shared/http/latest-request';
import { PendingAction } from '../../../shared/domain/pending-action';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { JobDetailComponent } from '../components/job-detail.component';
import { JobRunConfirmComponent } from '../components/job-run-confirm.component';
import { TasksTabsComponent } from '../components/tasks-tabs.component';
import { durationOf, jobMetricsOf, jobStateOf, type JobStateView } from '../data/job-view';
import { TasksApi, runJobErrorKey } from '../data/tasks.api';
import type { JobKey, JobView } from '../data/tasks.models';

const COLUMNS: readonly DataColumn[] = [
  { key: 'job', labelKey: 'task.job.col.job', width: 'minmax(0, 2fr)' },
  { key: 'result', labelKey: 'task.job.col.result', width: '130px' },
  { key: 'last', labelKey: 'task.job.col.last', width: '150px' },
  { key: 'duration', labelKey: 'task.job.col.duration', width: '100px' },
  { key: 'detail', labelKey: 'task.job.col.detail', width: 'minmax(0, 1.6fr)' },
  { key: 'chevron', width: '24px', align: 'end' },
];

export const JOB_POLL_MS = 3000;

@Component({
  selector: 'dba-jobs',
  imports: [
    TranslatePipe,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    IconComponent,
    JobDetailComponent,
    JobRunConfirmComponent,
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
          <span class="dba-meta">{{ 'task.job.lead' | translate }}</span>
        </div>
        <button dba-button variant="secondary" [disabled]="refreshing()" (click)="refresh()">
          {{ 'task.refresh' | translate }}
        </button>
      </header>

      <dba-tasks-tabs active="jobs" />

      @if (loading()) {
        <db-section-loader [label]="'task.job.loading' | translate" />
      } @else if (error()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="task.job.errorTitle" leadKey="task.errorLead" />
          <button dba-button variant="secondary" (click)="load(true)">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'task.tab.jobs' | translate"
          [dense]="density.compact()"
          minWidth="880px"
        >
          @for (job of jobs(); track job.key) {
            <button type="button" class="dba-tr bl-row" (click)="selectedKey.set(job.key)">
              <span class="dba-td cell">
                <span class="cell__label">{{ 'task.job.' + job.key + '.name' | translate }}</span>
                <span class="cell__muted">{{ 'task.job.' + job.key + '.schedule' | translate }}</span>
              </span>
              <span class="dba-td cell">
                <dba-org-state [state]="stateOf(job).state" [labelKey]="stateOf(job).labelKey" variant="inline" />
              </span>
              <span class="dba-td cell"><span class="cell__muted dba-mono">{{ when(job.last?.finishedAt) }}</span></span>
              <span class="dba-td cell"><span class="cell__muted dba-mono">{{ durationText(job) }}</span></span>
              <span class="dba-td cell"><span class="cell__muted">{{ detailOf(job) }}</span></span>
              <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
            </button>
          }
        </dba-data-table>
      }
    </section>

    @if (selected(); as job) {
      @if (confirming()) {
        <dba-job-run-confirm
          [job]="job"
          [busy]="pending.key() === 'run'"
          (submitted)="run(job.key, $event)"
          (dismissed)="confirming.set(false)"
        />
      } @else {
        <dba-job-detail [job]="job" (run)="confirming.set(true)" (dismissed)="selectedKey.set(null)" />
      }
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
})
export class JobsComponent {
  private readonly api = inject(TasksApi);
  private readonly locale = inject(LOCALE_ID);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly latest = new LatestRequest();
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly density = inject(DensityService);
  protected readonly pending = new PendingAction();
  protected readonly columns = COLUMNS;
  protected readonly loading = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly error = signal(false);
  protected readonly jobs = signal<JobView[]>([]);
  protected readonly selectedKey = signal<JobKey | null>(null);
  protected readonly confirming = signal(false);
  protected readonly selected = computed(
    () => this.jobs().find((job) => job.key === this.selectedKey()) ?? null,
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopPolling());
    void this.load(true);
  }

  protected stateOf(job: JobView): JobStateView {
    return jobStateOf(job);
  }

  protected when(value: string | undefined): string {
    return value ? formatDate(value, 'd/MM/y, HH:mm', this.locale) : '—';
  }

  protected durationText(job: JobView): string {
    return job.last ? durationOf(job.last.durationMs) : '—';
  }

  protected detailOf(job: JobView): string {
    if (!job.last) return '—';
    if (job.last.error) return job.last.error;
    const metrics = jobMetricsOf(job.last.metrics);
    if (metrics.length === 0) return this.translate.instant('task.job.noWork') as string;
    return metrics
      .map((metric) => `${this.translate.instant(metric.labelKey) as string} ${metric.value}`)
      .join(' · ');
  }

  protected refresh(): void {
    void this.load(false);
  }

  protected async run(key: JobKey, reason: string): Promise<void> {
    if (this.pending.key()) return;
    await this.pending.run('run', async () => {
      try {
        await firstValueFrom(this.api.runJob(key, reason));
        this.notify.success(this.translate.instant('task.job.run.started') as string);
      } catch (error) {
        this.notify.error(this.translate.instant(runJobErrorKey(error)) as string);
      }
      this.confirming.set(false);
      await this.load(false);
      this.watch(key);
    });
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
      const { jobs } = await firstValueFrom(this.api.jobs());
      if (!current()) return;
      this.jobs.set(jobs);
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

  private watch(key: JobKey): void {
    this.stopPolling();
    if (!this.jobs().find((job) => job.key === key)?.running) return;
    this.pollTimer = setTimeout(() => {
      void this.load(false).then(() => {
        if (!this.error()) this.watch(key);
      });
    }, JOB_POLL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }
}

import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { ModalShellComponent } from '../../../shared/ui/modal-shell.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { durationOf, jobMetricsOf, jobStateOf } from '../data/job-view';
import type { JobView } from '../data/tasks.models';

@Component({
  selector: 'dba-job-detail',
  imports: [TranslatePipe, ModalShellComponent, OrgStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <db-modal-shell
      icon="clock"
      [title]="'task.job.' + job().key + '.name' | translate"
      [subtitle]="'task.job.' + job().key + '.schedule' | translate"
      [maxWidth]="620"
      [confirmLabel]="canRun() ? 'task.job.run.action' : 'common.close'"
      [confirmDisabled]="!!job().running"
      [cancelable]="canRun()"
      cancelLabel="common.close"
      (confirmed)="canRun() ? run.emit() : dismissed.emit()"
      (dismissed)="dismissed.emit()"
    >
      <dl class="item">
        <dt>{{ 'task.job.col.result' | translate }}</dt>
        <dd><dba-org-state [state]="state().state" [labelKey]="state().labelKey" variant="inline" /></dd>
        @if (job().running; as running) {
          <dt>{{ 'task.job.runningSince' | translate }}</dt>
          <dd class="dba-mono">{{ when(running.since) }}</dd>
        }
        @if (job().last; as last) {
          <dt>{{ 'task.job.col.last' | translate }}</dt>
          <dd class="dba-mono">{{ when(last.finishedAt) }}</dd>
          <dt>{{ 'task.job.col.duration' | translate }}</dt>
          <dd class="dba-mono">{{ duration(last.durationMs) }}</dd>
          <dt>{{ 'task.job.trigger' | translate }}</dt>
          <dd>{{ 'task.job.triggerOf.' + last.trigger | translate }}</dd>
          @if (last.result !== 'failed') {
            <dt>{{ 'task.job.col.detail' | translate }}</dt>
            <dd>
              @for (metric of metrics(); track metric.labelKey) {
                <span class="item__metric">{{ metric.labelKey | translate }} <b class="dba-mono">{{ metric.value }}</b></span>
              } @empty {
                {{ 'task.job.noWork' | translate }}
              }
            </dd>
          }
        }
      </dl>

      @if (job().lastFailure; as failure) {
        <h3 class="dba-panel item__heading">
          {{ 'task.job.lastFailure' | translate }} · <span class="dba-mono">{{ when(failure.at) }}</span>
        </h3>
        <pre class="item__error dba-mono">{{ failure.error }}</pre>
      }

      @if (!job().manual) {
        <p class="dba-meta item__note">{{ 'task.job.noManual' | translate }}</p>
      }
    </db-modal-shell>
  `,
  styles: `
    .item {
      display: grid;
      grid-template-columns: minmax(120px, auto) minmax(0, 1fr);
      gap: 8px 16px;
      margin: 0;
      font-size: var(--dba-text-label);
    }

    .item dt {
      color: var(--dba-text-muted);
    }

    .item dd {
      margin: 0;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .item__metric {
      display: inline-block;
      margin-inline-end: 14px;
    }

    .item__metric b {
      font-weight: 600;
    }

    .item__heading {
      margin: 18px 0 8px;
    }

    .item__note {
      margin: 14px 0 0;
    }

    .item__error {
      margin: 0;
      padding: 12px;
      max-height: 260px;
      overflow: auto;
      border: 1px solid var(--dba-border);
      border-radius: var(--dba-radius-control);
      background: var(--dba-surface-muted);
      font-size: var(--dba-text-small);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  `,
})
export class JobDetailComponent {
  readonly job = input.required<JobView>();
  readonly dismissed = output<void>();
  readonly run = output<void>();

  private readonly auth = inject(AuthStore);
  private readonly locale = inject(LOCALE_ID);

  protected readonly canRun = computed(() => this.job().manual && this.auth.canManage('operations'));
  protected readonly state = computed(() => jobStateOf(this.job()));
  protected readonly metrics = computed(() => jobMetricsOf(this.job().last?.metrics ?? {}));

  protected when(value: string): string {
    return formatDate(value, 'd/MM/y, HH:mm:ss', this.locale);
  }

  protected duration(ms: number): string {
    return durationOf(ms);
  }
}

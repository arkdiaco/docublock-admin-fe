import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { durationOf } from '../data/job-view';
import { itemStateOf, runStateOf, type MaintenanceStateView } from '../data/maintenance-view';
import type { MaintenanceItemState, MaintenanceRun } from '../data/tasks.models';

@Component({
  selector: 'dba-maintenance-run',
  imports: [TranslatePipe, OrgStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dl class="run">
      <dt>{{ 'task.mnt.history.col.result' | translate }}</dt>
      <dd><dba-org-state [state]="state().state" [labelKey]="state().labelKey" variant="inline" /></dd>
      <dt>{{ 'task.mnt.history.col.when' | translate }}</dt>
      <dd class="dba-mono">{{ when(run().finishedAt ?? run().startedAt) }}</dd>
      <dt>{{ 'task.mnt.history.col.who' | translate }}</dt>
      <dd>{{ run().admin?.name || '—' }}</dd>
      @if (run().durationMs !== null) {
        <dt>{{ 'task.job.col.duration' | translate }}</dt>
        <dd class="dba-mono">{{ duration() }}</dd>
      }
      @if (run().reason; as reason) {
        <dt>{{ 'task.mnt.history.col.reason' | translate }}</dt>
        <dd>{{ reason }}</dd>
      }
      @if (run().state !== 'running' && run().state !== 'failed') {
        <dt>{{ 'task.mnt.history.col.rows' | translate }}</dt>
        <dd>
          <span class="run__count">{{ 'task.mnt.count.scanned' | translate }} <b class="dba-mono">{{ run().scanned }}</b></span>
          <span class="run__count">{{ 'task.mnt.count.pending' | translate }} <b class="dba-mono">{{ run().pending }}</b></span>
          @if (run().mode === 'execution') {
            <span class="run__count">{{ 'task.mnt.count.changed' | translate }} <b class="dba-mono">{{ run().changed }}</b></span>
          }
          @if (run().failed > 0) {
            <span class="run__count">{{ 'task.mnt.count.failed' | translate }} <b class="dba-mono">{{ run().failed }}</b></span>
          }
        </dd>
      }
    </dl>

    @if (run().error; as error) {
      <pre class="run__error dba-mono">{{ error }}</pre>
    }

    @if (run().items.length > 0) {
      <ul class="run__items">
        @for (item of run().items; track $index) {
          <li class="run__item">
            <span class="run__name">
              <span class="run__label">{{ item.label }}</span>
              @if (item.detail) {
                <span class="run__detail dba-mono">{{ item.detail }}</span>
              }
            </span>
            <dba-org-state [state]="itemState(item.state).state" [labelKey]="itemState(item.state).labelKey" variant="inline" />
          </li>
        }
      </ul>
      @if (run().itemsTruncated) {
        <p class="dba-meta run__note">{{ 'task.mnt.note.truncated' | translate }}</p>
      }
    }
  `,
  styles: `
    .run {
      display: grid;
      grid-template-columns: minmax(120px, auto) minmax(0, 1fr);
      gap: 8px 16px;
      margin: 0;
      font-size: var(--dba-text-label);
    }

    .run dt {
      color: var(--dba-text-muted);
    }

    .run dd {
      margin: 0;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .run__count {
      display: inline-block;
      margin-inline-end: 14px;
    }

    .run__count b {
      font-weight: 600;
    }

    .run__items {
      display: flex;
      flex-direction: column;
      gap: 0;
      margin: 12px 0 0;
      padding: 0;
      max-height: 240px;
      overflow: auto;
      list-style: none;
      border: 1px solid var(--dba-border);
      border-radius: var(--dba-radius-control);
    }

    .run__item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 12px;
      font-size: var(--dba-text-label);
    }

    .run__item + .run__item {
      border-top: 1px solid var(--dba-border);
    }

    .run__name {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .run__label {
      overflow-wrap: anywhere;
    }

    .run__detail {
      color: var(--dba-text-muted);
      font-size: var(--dba-text-small);
      overflow-wrap: anywhere;
    }

    .run__note {
      margin: 8px 0 0;
    }

    .run__error {
      margin: 12px 0 0;
      padding: 12px;
      max-height: 200px;
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
export class MaintenanceRunComponent {
  readonly run = input.required<MaintenanceRun>();

  private readonly locale = inject(LOCALE_ID);

  protected readonly state = computed(() => runStateOf(this.run()));
  protected readonly duration = computed(() => durationOf(this.run().durationMs ?? 0));

  protected itemState(state: MaintenanceItemState): MaintenanceStateView {
    return itemStateOf(state);
  }

  protected when(value: string): string {
    return formatDate(value, 'd/MM/y, HH:mm:ss', this.locale);
  }
}

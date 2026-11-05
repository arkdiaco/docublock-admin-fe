import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { sectionPath } from '../../../core/layout/console-nav';
import { UnderlineTabsComponent, type UnderlineTab } from '../../../shared/ui/underline-tabs.component';

export type TasksTab = 'queues' | 'jobs';

@Component({
  selector: 'dba-tasks-tabs',
  imports: [TranslatePipe, UnderlineTabsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<db-underline-tabs [tabs]="tabs()" [active]="active()" [label]="'nav.tasks' | translate" />`,
})
export class TasksTabsComponent {
  readonly active = input.required<TasksTab>();

  private readonly translate = inject(TranslateService);
  private readonly path = sectionPath('tasks');

  protected readonly tabs = computed<UnderlineTab[]>(() => [
    { key: 'queues', label: this.translate.instant('task.tab.queues') as string, link: [this.path] },
    { key: 'jobs', label: this.translate.instant('task.tab.jobs') as string, link: [this.path, 'jobs'] },
  ]);
}

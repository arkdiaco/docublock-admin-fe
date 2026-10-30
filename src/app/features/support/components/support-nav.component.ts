import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { sectionPath } from '../../../core/layout/console-nav';
import {
  UnderlineTabsComponent,
  type UnderlineTab,
} from '../../../shared/ui/underline-tabs.component';

export type SupportSection = 'tickets' | 'policies';

@Component({
  selector: 'dba-support-nav',
  imports: [TranslatePipe, UnderlineTabsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="sn">
      <div class="sn__title">
        <h1 class="dba-page">{{ 'nav.support' | translate }}</h1>
        @if (meta()) {
          <span class="dba-meta">{{ meta() }}</span>
        }
      </div>
      <ng-content />
    </header>
    <db-underline-tabs [tabs]="tabs()" [active]="active()" [label]="'nav.support' | translate" />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .sn {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .sn__title {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
  `,
})
export class SupportNavComponent {
  private readonly translate = inject(TranslateService);
  private readonly base = sectionPath('support');

  readonly active = input.required<SupportSection>();
  readonly meta = input('');

  protected readonly tabs = computed<UnderlineTab[]>(() => [
    {
      key: 'tickets',
      label: this.translate.instant('support.section.tickets') as string,
      link: this.base,
    },
    {
      key: 'policies',
      label: this.translate.instant('support.section.policies') as string,
      link: [this.base, 'politicas'],
    },
  ]);
}

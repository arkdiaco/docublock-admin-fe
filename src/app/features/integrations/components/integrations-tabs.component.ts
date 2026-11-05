import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { sectionPath } from '../../../core/layout/console-nav';
import { UnderlineTabsComponent, type UnderlineTab } from '../../../shared/ui/underline-tabs.component';
import { ORG_PARAM } from '../data/filter-url';

export type IntegrationsTab = 'deliveries' | 'keys' | 'endpoints';

@Component({
  selector: 'dba-integrations-tabs',
  imports: [TranslatePipe, UnderlineTabsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<db-underline-tabs [tabs]="tabs()" [active]="active()" [label]="'nav.integrations' | translate" />`,
})
export class IntegrationsTabsComponent {
  readonly active = input.required<IntegrationsTab>();
  readonly organizationId = input<string | null>(null);

  private readonly translate = inject(TranslateService);
  private readonly path = sectionPath('integrations');

  protected readonly tabs = computed<UnderlineTab[]>(() => {
    const id = this.organizationId();
    const query = id ? { [ORG_PARAM]: id } : undefined;
    return [
      { key: 'deliveries', label: this.translate.instant('dlv.tab.deliveries') as string, link: [this.path], query },
      { key: 'keys', label: this.translate.instant('dlv.tab.keys') as string, link: [this.path, 'claves'], query },
      {
        key: 'endpoints',
        label: this.translate.instant('dlv.tab.endpoints') as string,
        link: [this.path, 'destinos'],
        query,
      },
    ];
  });
}

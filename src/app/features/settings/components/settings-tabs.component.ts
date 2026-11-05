import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { sectionPath } from '../../../core/layout/console-nav';
import {
  UnderlineTabsComponent,
  type UnderlineTab,
} from '../../../shared/ui/underline-tabs.component';

export type SettingsTab =
  'alerts' | 'access' | 'signing' | 'validation' | 'texts' | 'credentials' | 'history';

@Component({
  selector: 'dba-settings-tabs',
  imports: [TranslatePipe, UnderlineTabsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<db-underline-tabs
    [tabs]="tabs()"
    [active]="active()"
    [label]="'nav.settings' | translate"
  />`,
})
export class SettingsTabsComponent {
  readonly active = input.required<SettingsTab>();

  private readonly translate = inject(TranslateService);
  private readonly path = sectionPath('settings');

  protected readonly tabs = computed<UnderlineTab[]>(() => [
    { key: 'alerts', label: this.translate.instant('cfg.tab.alerts') as string, link: [this.path] },
    {
      key: 'access',
      label: this.translate.instant('cfg.tab.access') as string,
      link: [this.path, 'accesos'],
    },
    {
      key: 'signing',
      label: this.translate.instant('cfg.tab.signing') as string,
      link: [this.path, 'firma'],
    },
    {
      key: 'validation',
      label: this.translate.instant('cfg.tab.validation') as string,
      link: [this.path, 'validacion'],
    },
    {
      key: 'texts',
      label: this.translate.instant('cfg.tab.texts') as string,
      link: [this.path, 'textos'],
    },
    {
      key: 'credentials',
      label: this.translate.instant('cfg.tab.credentials') as string,
      link: [this.path, 'credenciales'],
    },
    {
      key: 'history',
      label: this.translate.instant('cfg.tab.history') as string,
      link: [this.path, 'historial'],
    },
  ]);
}

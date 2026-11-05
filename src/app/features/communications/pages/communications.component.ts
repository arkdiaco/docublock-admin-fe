import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { sectionPath } from '../../../core/layout/console-nav';
import { UnderlineTabsComponent, type UnderlineTab } from '../../../shared/ui/underline-tabs.component';
import { CampaignComposerComponent } from '../components/campaign-composer.component';
import { CampaignHistoryComponent } from '../components/campaign-history.component';
import { HISTORY_VIEW } from '../data/campaign-state';

type CommunicationsView = 'new' | 'history';

@Component({
  selector: 'dba-communications',
  imports: [TranslatePipe, CampaignComposerComponent, CampaignHistoryComponent, UnderlineTabsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.communications' | translate }}</h1>
          <span class="dba-meta">{{ 'comm.lead' | translate }}</span>
        </div>
      </header>

      <db-underline-tabs
        [tabs]="views()"
        [active]="view()"
        [label]="'nav.communications' | translate"
        (picked)="view.set($any($event))"
      />
      <div [hidden]="view() !== 'new'">
        <dba-campaign-composer (created)="open($event.id)" (uncertain)="view.set('history')" />
      </div>
      @if (view() === 'history') {
        <dba-campaign-history />
      }
    </section>
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
})
export class CommunicationsComponent {
  readonly vista = input<string>();

  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly view = signal<CommunicationsView>('new');
  protected readonly views = computed((): UnderlineTab[] => [
    {
      key: 'new',
      label: this.label(this.auth.canManage('catalogs') ? 'comm.view.new' : 'comm.view.recipients'),
    },
    { key: 'history', label: this.label('comm.view.history') },
  ]);

  constructor() {
    effect(() => {
      if (this.vista() === HISTORY_VIEW) this.view.set('history');
    });
  }

  protected open(id: string): void {
    void this.router.navigate([sectionPath('communications'), id]);
  }

  private label(key: string): string {
    return this.translate.instant(key) as string;
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { DensityService } from '../../../core/preferences/density.service';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { CredentialDetailComponent } from '../components/credential-detail.component';
import { SettingsTabsComponent } from '../components/settings-tabs.component';
import {
  credentialStateOf,
  knownCredentialGroups,
  piecesOf,
  type CredentialStateView,
} from '../data/credentials-view';
import { SettingsApi } from '../data/settings.api';
import type { CredentialGroup } from '../data/settings.models';

const COLUMNS: readonly DataColumn[] = [
  { key: 'integration', labelKey: 'cfg.cred.col.integration', width: 'minmax(0, 2.4fr)' },
  { key: 'state', labelKey: 'cfg.cred.col.state', width: '170px' },
  { key: 'pieces', labelKey: 'cfg.cred.col.pieces', width: '140px' },
  { key: 'chevron', width: '24px', align: 'end' },
];

@Component({
  selector: 'dba-settings-credentials',
  imports: [
    TranslatePipe,
    ButtonComponent,
    CredentialDetailComponent,
    DataTableComponent,
    EmptyStateComponent,
    IconComponent,
    OrgStateComponent,
    SectionLoaderComponent,
    SettingsTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bl">
      <header class="bl__head">
        <div class="bl__title">
          <h1 class="dba-page">{{ 'nav.settings' | translate }}</h1>
          <span class="dba-meta">{{ 'cfg.cred.lead' | translate }}</span>
        </div>
        <button dba-button variant="secondary" [disabled]="refreshing()" (click)="load(false)">
          {{ 'cfg.refresh' | translate }}
        </button>
      </header>

      <dba-settings-tabs active="credentials" />

      @if (loading()) {
        <db-section-loader [label]="'cfg.cred.loading' | translate" />
      } @else if (error()) {
        <div class="bl__panel">
          <dba-empty-state titleKey="cfg.cred.errorTitle" leadKey="cfg.errorLead" />
          <button dba-button variant="secondary" (click)="load(true)">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'cfg.tab.credentials' | translate"
          [dense]="density.compact()"
          minWidth="720px"
        >
          @for (group of groups(); track group.key) {
            <button type="button" class="dba-tr bl-row" (click)="selectedKey.set(group.key)">
              <span class="dba-td cell">
                <span class="cell__label">{{
                  'cfg.cred.group.' + group.key + '.label' | translate
                }}</span>
                <span class="cell__muted">{{
                  'cfg.cred.group.' + group.key + '.use' | translate
                }}</span>
              </span>
              <span class="dba-td cell">
                <dba-org-state
                  [state]="stateOf(group).state"
                  [labelKey]="stateOf(group).labelKey"
                  variant="inline"
                />
              </span>
              <span class="dba-td cell"
                ><span class="cell__text dba-mono">{{
                  'cfg.cred.pieces' | translate: piecesOf(group)
                }}</span></span
              >
              <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
            </button>
          }
        </dba-data-table>
        <p class="dba-meta cred-note">{{ 'cfg.cred.note' | translate }}</p>
      }
    </section>

    @if (selected(); as group) {
      <dba-credential-detail [group]="group" (dismissed)="selectedKey.set(null)" />
    }
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
  styles: `
    .cred-note {
      margin: 0;
      line-height: 1.45;
    }
  `,
})
export class SettingsCredentialsComponent {
  private readonly api = inject(SettingsApi);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly loading = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly error = signal(false);
  protected readonly groups = signal<CredentialGroup[]>([]);
  protected readonly selectedKey = signal<string | null>(null);
  protected readonly selected = computed(
    () => this.groups().find((group) => group.key === this.selectedKey()) ?? null,
  );
  protected readonly piecesOf = piecesOf;

  constructor() {
    void this.load(true);
  }

  protected stateOf(group: CredentialGroup): CredentialStateView {
    return credentialStateOf(group.state);
  }

  protected async load(withLoader: boolean): Promise<void> {
    const current = this.latest.start();
    if (withLoader) this.loading.set(true);
    else this.refreshing.set(true);
    try {
      const { groups } = await firstValueFrom(this.api.credentials());
      if (!current()) return;
      this.groups.set(knownCredentialGroups(groups));
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

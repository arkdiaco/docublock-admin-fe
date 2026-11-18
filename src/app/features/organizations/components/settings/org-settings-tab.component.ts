import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../../core/auth/auth.store';
import { DialogService } from '../../../../core/ui/dialog.service';
import { NotificationService } from '../../../../core/ui/notification.service';
import { errorCodeOf } from '../../../../shared/http/error-code';
import { LatestRequest } from '../../../../shared/http/latest-request';
import { ButtonComponent } from '../../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state.component';
import { ModuleToggleComponent } from '../../../../shared/ui/module-toggle.component';
import { SectionLoaderComponent } from '../../../../shared/ui/section-loader.component';
import type { PlatformOrgDetail } from '../../data/organizations.models';
import { ValidationsApi } from '../../data/validations.api';
import {
  ORG_OPTION_GROUPS,
  type OrgOption,
  type OrgSettings,
} from '../../data/validations.models';

const ABBR: Record<OrgOption, string> = {
  whatsapp: 'WA',
  skipVisualSign: 'FV',
  blockComments: 'RM',
  documentPhotos: 'FD',
};

const KNOWN_ERRORS = ['SETTINGS_SIN_CAMBIOS'];

@Component({
  selector: 'dba-org-settings-tab',
  imports: [
    TranslatePipe,
    ButtonComponent,
    EmptyStateComponent,
    ModuleToggleComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'ost.loading' | translate" />
    } @else if (error()) {
      <div class="ost__panel">
        <dba-empty-state titleKey="ost.errorTitle" leadKey="ost.errorLead" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (settings(); as current) {
      <div class="ost">
        <p class="dba-meta ost__lead">{{ 'ost.lead' | translate }}</p>
        @for (group of groups; track group.key) {
          <section class="ost__card">
            <header class="ost__head">
              <h2 class="dba-panel">{{ 'ost.group.' + group.key | translate }}</h2>
              <p class="dba-meta ost__lead">{{ 'ost.groupLead.' + group.key | translate }}</p>
            </header>
            <div class="ost__toggles">
              @for (key of group.options; track key) {
                <dba-module-toggle
                  [abbr]="abbr[key]"
                  [name]="'ost.option.' + key | translate"
                  [meta]="'ost.hint.' + key | translate"
                  [on]="current.selfService[key]"
                  [disabled]="!canManage() || working()"
                  (toggled)="toggle(key, $event)"
                />
              }
            </div>
          </section>
        }
      </div>
    }
  `,
  styles: `
    .ost {
      display: flex;
      flex-direction: column;
      gap: var(--dba-grid-gap);
    }

    .ost__card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .ost__head {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .ost__lead {
      margin: 0;
    }

    .ost__toggles {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1px;
      overflow: hidden;
      border: 1px solid var(--dba-border-row);
      border-radius: var(--dba-radius-control);
      background: var(--dba-border-row);
    }

    .ost__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    @media (max-width: 720px) {
      .ost__toggles {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class OrgSettingsTabComponent {
  readonly org = input.required<PlatformOrgDetail>();

  private readonly api = inject(ValidationsApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly latest = new LatestRequest();
  private readonly orgId = computed(() => this.org().id);

  protected readonly groups = ORG_OPTION_GROUPS;
  protected readonly abbr = ABBR;
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly working = signal(false);
  protected readonly settings = signal<OrgSettings | null>(null);
  protected readonly canManage = computed(() => this.auth.canManage('clients'));

  constructor() {
    effect(() => {
      if (this.orgId()) untracked(() => void this.reload());
    });
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(this.settings() === null);
    this.error.set(false);
    try {
      const settings = await firstValueFrom(this.api.settings(this.orgId()));
      if (current()) this.settings.set(settings);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  protected async toggle(key: OrgOption, value: boolean): Promise<void> {
    const name = this.t('ost.option.' + key);
    const answer = await this.dialogs.open({
      intent: value ? 'primary' : 'danger',
      icon: value ? 'circleCheck' : 'circleX',
      title: value ? 'ost.onTitle' : 'ost.offTitle',
      message: value ? 'ost.onMessage' : 'ost.offMessage',
      params: { name, org: this.org().businessName },
      confirmLabel: value ? 'ost.on' : 'ost.off',
      reason: {
        labelKey: 'sub.reasonLabel',
        placeholder: 'sub.reasonPlaceholder',
        limit: 500,
        quick: [],
        required: true,
      },
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    this.working.set(true);
    try {
      const settings = await firstValueFrom(
        this.api.setSetting(this.orgId(), key, value, answer.reason),
      );
      this.settings.set(settings);
      this.notify.success(this.t(value ? 'ost.done.on' : 'ost.done.off', { name }));
    } catch (error) {
      const code = errorCodeOf(error);
      const known = code !== null && KNOWN_ERRORS.includes(code);
      this.notify.error(this.t(known ? `ost.error.${code}` : 'ost.error.generic'));
    } finally {
      this.working.set(false);
    }
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}

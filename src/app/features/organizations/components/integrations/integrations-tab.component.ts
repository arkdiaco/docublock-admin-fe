import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
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
import { LatestRequest } from '../../../../shared/http/latest-request';
import { ButtonComponent } from '../../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state.component';
import { OrgStateComponent } from '../../../../shared/ui/org-state.component';
import { SectionLoaderComponent } from '../../../../shared/ui/section-loader.component';
import { IntegrationsApi } from '../../data/integrations.api';
import type { IntegrationKeyState, OrgIntegrations } from '../../data/integrations.models';
import type { PlatformOrgDetail } from '../../data/organizations.models';
import { ApiKeyRevealComponent } from './api-key-reveal.component';

const KEY_COLUMNS: readonly DataColumn[] = [
  { key: 'name', labelKey: 'integ.col.name', width: 'minmax(180px, 1.4fr)' },
  { key: 'prefix', labelKey: 'integ.col.prefix', width: '150px' },
  { key: 'scopes', labelKey: 'integ.col.scopes', width: 'minmax(160px, 1.2fr)' },
  { key: 'state', labelKey: 'integ.col.state', width: '120px' },
  { key: 'expires', labelKey: 'integ.col.expires', width: '110px' },
  { key: 'used', labelKey: 'integ.col.used', width: '110px' },
];

const ENDPOINT_COLUMNS: readonly DataColumn[] = [
  { key: 'url', labelKey: 'integ.col.url', width: 'minmax(240px, 2fr)' },
  { key: 'events', labelKey: 'integ.col.events', width: '110px', align: 'end' },
  { key: 'contract', labelKey: 'integ.col.contract', width: '110px' },
  { key: 'state', labelKey: 'integ.col.state', width: '120px' },
];

const KEY_STATE: Record<IntegrationKeyState, string> = {
  active: 'active',
  rotating: 'trial',
  revoked: 'closed',
  expired: 'warning',
};

@Component({
  selector: 'dba-integrations-tab',
  imports: [
    TranslatePipe,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    OrgStateComponent,
    SectionLoaderComponent,
    ApiKeyRevealComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'integ.loading' | translate" />
    } @else if (error() || !view()) {
      <div class="it__panel">
        <dba-empty-state titleKey="integ.errorTitle" leadKey="integ.errorLead" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else {
      @let data = view()!;
      <div class="it">
        <section class="it__card">
          <header class="it__head">
            <div class="it__title">
              <h2 class="dba-panel">{{ 'integ.apiKey.title' | translate }}</h2>
              <p class="dba-meta it__lead">{{ 'integ.apiKey.lead' | translate }}</p>
            </div>
            @if (canManage()) {
              <button
                dba-button
                [variant]="data.apiKey.hasKey ? 'secondary' : 'primary'"
                [busy]="working()"
                (click)="rotate()"
              >
                {{
                  (data.apiKey.hasKey ? 'integ.apiKey.rotate' : 'integ.apiKey.generate') | translate
                }}
              </button>
            }
          </header>
          <dl class="it__dl">
            <dt>{{ 'integ.apiKey.state' | translate }}</dt>
            <dd>
              <dba-org-state
                [state]="data.apiKey.hasKey ? 'active' : 'closed'"
                [labelKey]="data.apiKey.hasKey ? 'integ.apiKey.issued' : 'integ.apiKey.missing'"
                variant="inline"
              />
            </dd>
            @if (data.apiKey.hasKey) {
              <dt>{{ 'integ.apiKey.preview' | translate }}</dt>
              <dd class="dba-mono">{{ data.apiKey.preview }}</dd>
              <dt>{{ 'integ.apiKey.issuedAt' | translate }}</dt>
              <dd class="dba-mono">{{ day(data.apiKey.issuedAt) }}</dd>
            }
          </dl>
        </section>

        <section class="it__card">
          <div class="it__title">
            <h2 class="dba-panel">{{ 'integ.classic.title' | translate }}</h2>
            <p class="dba-meta it__lead">{{ 'integ.classic.lead' | translate }}</p>
          </div>
          @if (!data.classicWebhook.url) {
            <p class="dba-body it__muted">{{ 'integ.classic.none' | translate }}</p>
          } @else {
            <dl class="it__dl">
              <dt>{{ 'integ.classic.url' | translate }}</dt>
              <dd class="dba-mono it__wrap">{{ data.classicWebhook.url }}</dd>
              <dt>{{ 'integ.classic.state' | translate }}</dt>
              <dd>
                <dba-org-state
                  [state]="data.classicWebhook.enabled ? 'active' : 'suspended'"
                  [labelKey]="data.classicWebhook.enabled ? 'integ.on' : 'integ.off'"
                  variant="inline"
                />
              </dd>
              <dt>{{ 'integ.classic.secret' | translate }}</dt>
              <dd>
                {{
                  (data.classicWebhook.secretConfigured
                    ? 'integ.classic.secretYes'
                    : 'integ.classic.secretNo'
                  ) | translate
                }}
                @if (data.classicWebhook.secretRotatedAt) {
                  <span class="dba-meta">
                    ·
                    {{
                      'integ.classic.rotated'
                        | translate: { date: day(data.classicWebhook.secretRotatedAt) }
                    }}</span
                  >
                }
              </dd>
              @if (data.classicWebhook.extraUrls.length) {
                <dt>{{ 'integ.classic.extra' | translate }}</dt>
                <dd class="dba-mono it__wrap">
                  @for (url of data.classicWebhook.extraUrls; track url) {
                    <span class="it__line">{{ url }}</span>
                  }
                </dd>
              }
            </dl>
          }
        </section>

        @if (data.bridge.state !== 'ok') {
          <section class="it__card">
            <h2 class="dba-panel">{{ 'integ.v2' | translate }}</h2>
            <p class="dba-body it__muted">{{ 'integ.bridge.' + data.bridge.state | translate }}</p>
          </section>
        } @else {
          <section class="it__card">
            <div class="it__title">
              <h2 class="dba-panel">
                {{ 'integ.keys.title' | translate: { total: data.bridge.keys.length } }}
              </h2>
              <p class="dba-meta it__lead">{{ 'integ.keys.lead' | translate }}</p>
            </div>
            @if (data.bridge.keys.length === 0) {
              <p class="dba-body it__muted">{{ 'integ.keys.none' | translate }}</p>
            } @else {
              <dba-data-table
                [columns]="keyColumns"
                [label]="'integ.keys.title' | translate: { total: data.bridge.keys.length }"
                minWidth="800px"
              >
                @for (key of data.bridge.keys; track key.id) {
                  <div class="dba-tr">
                    <span class="dba-td it__small">{{ key.name }}</span>
                    <code class="dba-td it__mono">{{ key.prefix }}…</code>
                    <span class="dba-td it__small" [attr.title]="key.scopes.join(', ')">{{
                      key.scopes.join(', ') || '—'
                    }}</span>
                    <span class="dba-td">
                      <dba-org-state
                        [state]="keyState(key.state)"
                        [labelKey]="'integ.keyState.' + key.state"
                        variant="inline"
                      />
                    </span>
                    <span class="dba-td dba-mono it__small">{{ day(key.expiresAt) }}</span>
                    <span class="dba-td dba-mono it__small">{{ day(key.lastUsedAt) }}</span>
                  </div>
                }
              </dba-data-table>
            }
          </section>

          <section class="it__card">
            <div class="it__title">
              <h2 class="dba-panel">
                {{ 'integ.endpoints.title' | translate: { total: data.bridge.endpoints.length } }}
              </h2>
              <p class="dba-meta it__lead">{{ 'integ.endpoints.lead' | translate }}</p>
            </div>
            @if (data.bridge.endpoints.length === 0) {
              <p class="dba-body it__muted">{{ 'integ.endpoints.none' | translate }}</p>
            } @else {
              <dba-data-table
                [columns]="endpointColumns"
                [label]="
                  'integ.endpoints.title' | translate: { total: data.bridge.endpoints.length }
                "
                minWidth="620px"
              >
                @for (endpoint of data.bridge.endpoints; track endpoint.id) {
                  <div class="dba-tr">
                    <span class="dba-td it__url">
                      <span class="it__mono">{{ endpoint.url }}</span>
                      @if (endpoint.description) {
                        <span class="dba-meta">{{ endpoint.description }}</span>
                      }
                    </span>
                    <span
                      class="dba-td dba-td--end dba-mono it__small"
                      [attr.title]="endpoint.events.join(', ')"
                      >{{ endpoint.events.length }}</span
                    >
                    <span class="dba-td it__small">{{
                      'integ.contract.' + endpoint.contract | translate
                    }}</span>
                    <span class="dba-td">
                      <dba-org-state
                        [state]="endpoint.enabled ? 'active' : 'suspended'"
                        [labelKey]="endpoint.enabled ? 'integ.on' : 'integ.off'"
                        variant="inline"
                      />
                    </span>
                  </div>
                }
              </dba-data-table>
            }
          </section>
        }
      </div>

      @if (revealed(); as key) {
        <dba-api-key-reveal
          [apiKey]="key"
          [orgName]="org().businessName"
          (closed)="revealed.set(null)"
        />
      }
    }
  `,
  styles: `
    .it {
      display: flex;
      flex-direction: column;
      gap: var(--dba-grid-gap);
    }

    .it__card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .it__head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .it__title {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .it__lead,
    .it__muted {
      margin: 0;
    }

    .it__muted {
      color: var(--dba-text-muted);
    }

    .it__dl {
      display: grid;
      grid-template-columns: 200px minmax(0, 1fr);
      gap: 8px 16px;
      margin: 0;
      font-size: var(--dba-text-cell);
    }

    .it__dl dt {
      color: var(--dba-text-muted);
    }

    .it__dl dd {
      margin: 0;
      color: var(--dba-ink);
    }

    .it__wrap {
      overflow-wrap: anywhere;
    }

    .it__line {
      display: block;
    }

    .it__url {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .it__mono {
      overflow: hidden;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-small);
      color: var(--dba-text);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .it__small {
      overflow: hidden;
      font-size: var(--dba-text-cell);
      color: var(--dba-text);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .it__panel {
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
      .it__dl {
        grid-template-columns: minmax(0, 1fr);
      }

      .it__dl dd {
        margin-bottom: 6px;
      }
    }
  `,
})
export class IntegrationsTabComponent {
  readonly org = input.required<PlatformOrgDetail>();

  private readonly api = inject(IntegrationsApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();
  private readonly orgId = computed(() => this.org().id);

  protected readonly keyColumns = KEY_COLUMNS;
  protected readonly endpointColumns = ENDPOINT_COLUMNS;
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly working = signal(false);
  protected readonly view = signal<OrgIntegrations | null>(null);
  protected readonly revealed = signal<string | null>(null);
  protected readonly canManage = computed(() => this.auth.canManage('clients'));

  constructor() {
    effect(() => {
      if (this.orgId()) untracked(() => void this.reload());
    });
  }

  protected day(value?: string | null): string {
    return value ? formatDate(value, 'd/MM/y', this.locale) : '—';
  }

  protected keyState(state: IntegrationKeyState): string {
    return KEY_STATE[state] ?? 'closed';
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(this.view() === null);
    this.error.set(false);
    try {
      const view = await firstValueFrom(this.api.overview(this.orgId()));
      if (current()) this.view.set(view);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  protected async rotate(): Promise<void> {
    const org = this.org();
    const hasKey = this.view()?.apiKey.hasKey === true;
    const answer = await this.dialogs.open({
      intent: hasKey ? 'danger' : 'primary',
      icon: 'lock',
      title: hasKey ? 'integ.rotateTitle' : 'integ.generateTitle',
      message: hasKey ? 'integ.rotateMessage' : 'integ.generateMessage',
      params: { name: org.businessName },
      confirmLabel: hasKey ? 'integ.apiKey.rotate' : 'integ.apiKey.generate',
      reason: {
        labelKey: 'sub.reasonLabel',
        placeholder: 'sub.reasonPlaceholder',
        limit: 500,
        quick: [],
        required: true,
      },
      ...(hasKey && {
        challenge: { identifier: org.tributaryNumber, actionKey: 'integ.rotateVerb' },
      }),
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    this.working.set(true);
    try {
      const rotated = await firstValueFrom(this.api.rotateApiKey(this.orgId(), answer.reason));
      this.revealed.set(rotated.apiKey);
      await this.reload();
    } catch {
      this.notify.error(this.translate.instant('integ.error.rotate') as string);
    } finally {
      this.working.set(false);
    }
  }
}

import { NgTemplateOutlet, formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { canSeeSection, sectionPath } from '../../../core/layout/console-nav';
import { formatCount, money } from '../../../shared/domain/money';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ActionRowComponent } from '../../../shared/ui/action-row.component';
import { AuditEventComponent } from '../../../shared/ui/audit-event.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { KpiCardComponent, type KpiDeltaTone } from '../../../shared/ui/kpi-card.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { activityKeyOf } from '../data/activity-actions';
import { DashboardApi } from '../data/dashboard.api';
import type { PlatformDashboard } from '../data/dashboard.models';
import { actionRowsOf, eventRef, revenueViewOf } from '../data/dashboard-view';

export const greetingKeyOf = (hour: number): string => {
  if (hour < 12) return 'overview.greeting.morning';
  if (hour < 19) return 'overview.greeting.afternoon';
  return 'overview.greeting.evening';
};

interface KpiView {
  label: string;
  value: string;
  link?: string;
  deltaKey: string;
  deltaParams: Record<string, string | number>;
  extraKey?: string;
  extraParams?: Record<string, string | number>;
  tone: KpiDeltaTone;
}

interface EventView {
  id: string;
  actor: string | null;
  key: string | null;
  code: string;
  org: string | null;
  meta: string;
}

@Component({
  selector: 'dba-overview',
  imports: [
    TranslatePipe,
    RouterLink,
    NgTemplateOutlet,
    KpiCardComponent,
    EmptyStateComponent,
    ActionRowComponent,
    AuditEventComponent,
    ButtonComponent,
    IconComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ov">
      <header class="ov__head">
        <div class="ov__title">
          <span class="dba-meta ov__date">{{ today }}</span>
          <h1 class="dba-page">{{ greetingKey | translate: { name: firstName() } }}</h1>
        </div>
        @if (canCreate()) {
          <a dba-button [routerLink]="orgsPath" [queryParams]="{ nueva: 1 }">
            <db-icon name="plus" [size]="15" />
            {{ 'orgCreate.open' | translate }}
          </a>
        }
      </header>

      @if (loading()) {
        <db-section-loader [label]="'overview.loading' | translate" />
      } @else if (error()) {
        <section class="panel panel--error">
          <dba-empty-state titleKey="overview.errorTitle" leadKey="overview.errorLead" />
          <button dba-button variant="secondary" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        </section>
      } @else {
        <div class="ov__kpis" [class.ov__kpis--three]="kpis().length === 3">
          @for (kpi of kpis(); track kpi.label) {
            @if (kpi.link; as link) {
              <a class="ov__kpiLink" [routerLink]="link">
                <ng-container [ngTemplateOutlet]="kpiCard" [ngTemplateOutletContext]="{ $implicit: kpi }" />
              </a>
            } @else {
              <ng-container [ngTemplateOutlet]="kpiCard" [ngTemplateOutletContext]="{ $implicit: kpi }" />
            }
          }
        </div>

        <ng-template #kpiCard let-kpi>
          <dba-kpi-card
            [label]="kpi.label"
            [value]="kpi.value"
            [delta]="
              (kpi.deltaKey | translate: kpi.deltaParams) +
              (kpi.extraKey ? ' · ' + (kpi.extraKey | translate: kpi.extraParams) : '')
            "
            [deltaTone]="kpi.tone"
          />
        </ng-template>

        <div class="ov__panels" [class.ov__panels--single]="events() === null">
          <section class="panel">
            <header class="panel__head">
              <span class="dba-panel">{{ 'overview.actions' | translate }}</span>
              <code class="dba-meta panel__count">{{ actions().total }}</code>
            </header>
            @if (actions().rows.length === 0) {
              <dba-empty-state titleKey="overview.actionsEmpty" leadKey="overview.actionsLead" />
            } @else {
              <div class="panel__rows">
                @for (row of actions().rows; track row.key) {
                  <dba-action-row
                    [tone]="row.tone"
                    [reference]="row.reference"
                    [subject]="row.subjectKey ? (row.subjectKey | translate) : row.subject"
                    [text]="row.textKey | translate: row.textParams"
                    [cta]="row.ctaKey | translate"
                    [link]="row.link"
                    [query]="row.query"
                  />
                }
              </div>
            }
          </section>

          @if (events(); as list) {
            <section class="panel">
              <header class="panel__head">
                <span class="dba-panel">{{ 'overview.activity' | translate }}</span>
                @if (canSeeAudit()) {
                  <a class="panel__link" [routerLink]="auditPath">{{ 'nav.audit' | translate }}</a>
                }
              </header>
              @if (list.length === 0) {
                <dba-empty-state
                  titleKey="overview.activityEmpty"
                  leadKey="overview.activityLead"
                />
              } @else {
                <div class="panel__events">
                  @for (event of list; track event.id; let last = $last) {
                    <dba-audit-event
                      [actor]="event.actor ?? ('overview.someone' | translate)"
                      [meta]="event.meta"
                      [last]="last"
                    >
                      @if (event.key) {
                        {{
                          event.key
                            | translate: { org: event.org ?? ('overview.someOrg' | translate) }
                        }}
                      } @else {
                        &ngsp;<code class="dba-ref">{{ event.code }}</code>
                        @if (event.org) {
                          · {{ event.org }}
                        }
                      }
                    </dba-audit-event>
                  }
                </div>
              }
            </section>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .ov {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .ov__head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
    }

    .ov__title {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .ov__date {
      text-transform: uppercase;
      letter-spacing: var(--dba-tracking-th);
    }

    .ov__kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--dba-grid-gap);
    }

    .ov__kpis--three {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .ov__kpiLink {
      display: block;
      min-width: 0;
      border-radius: var(--dba-radius-panel);
      color: inherit;
      text-decoration: none;
    }

    .ov__kpiLink:hover {
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .ov__panels {
      display: grid;
      grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
      align-items: start;
      gap: var(--dba-grid-gap);
    }

    .ov__panels--single {
      grid-template-columns: minmax(0, 1fr);
    }

    .panel {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
      overflow: hidden;
    }

    .panel--error {
      align-items: center;
      gap: 12px;
      padding-bottom: 24px;
    }

    .panel__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      border-bottom: 1px solid var(--dba-border-card);
    }

    .panel__count {
      font-variant-numeric: tabular-nums;
    }

    .panel__link {
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-violet-700);
      text-decoration: none;
    }

    .panel__events {
      padding: 16px 18px;
    }

    @media (max-width: 1100px) {
      .ov__kpis,
      .ov__kpis--three {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 760px) {
      .ov__kpis,
      .ov__kpis--three,
      .ov__panels {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class OverviewComponent {
  private readonly auth = inject(AuthStore);
  private readonly locale = inject(LOCALE_ID);
  private readonly api = inject(DashboardApi);
  private readonly latest = new LatestRequest();

  protected readonly today = formatDate(new Date(), 'fullDate', this.locale);
  protected readonly greetingKey = greetingKeyOf(new Date().getHours());
  protected readonly auditPath = sectionPath('audit');
  protected readonly orgsPath = sectionPath('organizations');
  private readonly actionPaths = {
    orgs: this.orgsPath,
    docs: sectionPath('documents'),
    support: sectionPath('support'),
  };
  protected readonly canSeeAudit = computed(() =>
    canSeeSection(this.auth.platformPermissions(), 'audit'),
  );
  protected readonly canCreate = computed(() => this.auth.canManage('clients'));
  protected readonly firstName = computed(
    () => (this.auth.user()?.names ?? '').trim().split(/\s+/)[0] ?? '',
  );

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  private readonly data = signal<PlatformDashboard | null>(null);

  protected readonly kpis = computed<KpiView[]>(() => {
    const data = this.data();
    if (!data) return [];
    const views: KpiView[] = [
      {
        label: 'overview.kpiOrgs',
        value: formatCount(data.organizations.total),
        deltaKey: 'overview.orgsDelta',
        deltaParams: { n: formatCount(data.organizations.createdThisMonth) },
        tone: data.organizations.createdThisMonth > 0 ? 'good' : 'plain',
      },
      {
        label: 'overview.kpiUsers',
        value: formatCount(data.activeUsers.last30Days),
        deltaKey: 'overview.usersDelta',
        deltaParams: {},
        tone: 'plain',
      },
    ];
    if (data.revenue) {
      const previous = new Date(
        Date.UTC(
          new Date(data.generatedAt).getUTCFullYear(),
          new Date(data.generatedAt).getUTCMonth() - 1,
          1,
        ),
      );
      const revenue = revenueViewOf(
        data.revenue,
        (amount, currency) => money(amount, currency, this.locale),
        formatDate(previous, 'MMM', this.locale, 'UTC'),
      );
      views.push({
        label: 'overview.kpiRevenue',
        value: revenue.value,
        link: `${sectionPath('billing')}/ingresos`,
        deltaKey: revenue.deltaKey,
        deltaParams: revenue.deltaParams,
        extraKey: revenue.others > 0 ? 'overview.revenueOthers' : undefined,
        extraParams: { n: revenue.others },
        tone: revenue.tone,
      });
    }
    views.push({
      label: 'overview.kpiWarn',
      value: formatCount(data.warnings.total),
      deltaKey: data.warnings.exhausted > 0 ? 'overview.warnDelta' : 'overview.warnNone',
      deltaParams: { n: formatCount(data.warnings.exhausted) },
      tone: data.warnings.total > 0 ? 'warn' : 'plain',
    });
    return views;
  });

  protected readonly actions = computed(() =>
    actionRowsOf(this.data()?.actions ?? [], this.actionPaths),
  );

  protected readonly events = computed<EventView[] | null>(() => {
    const activity = this.data()?.activity;
    if (!activity) return null;
    return activity.map((event) => ({
      id: event.id,
      actor: event.admin.name || null,
      key: activityKeyOf(event.action),
      code: event.action,
      org: event.organization?.name || null,
      meta: [
        event.createdAt ? formatDate(event.createdAt, 'dd-MMM HH:mm', this.locale) : '',
        eventRef(event.id),
      ]
        .filter((part) => !!part)
        .join(' · '),
    }));
  });

  constructor() {
    void this.reload();
  }

  protected async reload(): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const data = await firstValueFrom(this.api.load());
      if (current()) this.data.set(data);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }
}

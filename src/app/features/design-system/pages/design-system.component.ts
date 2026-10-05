import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { DialogService } from '../../../core/ui/dialog.service';
import { ORG_STATES } from '../../../shared/domain/org-state';
import { PLATFORM_ROLES } from '../../../shared/domain/platform-role';
import { AuditEventComponent } from '../../../shared/ui/audit-event.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { EnvPillComponent } from '../../../shared/ui/env-pill.component';
import { FieldComponent } from '../../../shared/ui/field.component';
import { FilterPillsComponent, type FilterPill } from '../../../shared/ui/filter-pills.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { KpiCardComponent } from '../../../shared/ui/kpi-card.component';
import { ModuleToggleComponent } from '../../../shared/ui/module-toggle.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { QuotaBarComponent } from '../../../shared/ui/quota-bar.component';
import { RoleTagComponent } from '../../../shared/ui/role-tag.component';

const RAMP = [
  ['50', '#F5F3FF'],
  ['100', '#EAE8FF'],
  ['200', '#DCD7FE'],
  ['300', '#C4BAFE'],
  ['400', '#A48CFE'],
  ['500', '#7954FD'],
  ['600', '#6438F0'],
  ['700', '#5227D2'],
  ['800', '#4020A8'],
  ['900', '#2C2054'],
  ['950', '#16121F'],
] as const;

const TYPE_SAMPLES = [
  { tag: 'page/28', cls: 'dba-page', key: 'sys.sample.page' },
  { tag: 'kpi/34', cls: 'dba-kpi', key: 'sys.sample.kpi' },
  { tag: 'panel/15', cls: 'dba-panel', key: 'sys.sample.panel' },
  { tag: 'body/13.5', cls: 'dba-body', key: 'sys.sample.body' },
  { tag: 'menu/13.5', cls: 'sys__menu', key: 'sys.sample.menu' },
  { tag: 'id/12 mono', cls: 'dba-id', key: 'sys.sample.id' },
  { tag: 'eyebrow/10', cls: 'dba-eyebrow', key: 'sys.sample.eyebrow' },
] as const;

const KPIS = [
  { key: 'sys.c.kpiOrgs', value: '312', delta: 'sys.c.kpiOrgsDelta', tone: 'good' },
  { key: 'sys.c.kpiUsers', value: '4 812', delta: 'sys.c.kpiUsersDelta', tone: 'good' },
  { key: 'sys.c.kpiSigns', value: '1 120', delta: 'sys.c.kpiSignsDelta', tone: 'good' },
  { key: 'sys.c.kpiWarn', value: '9', delta: 'sys.c.kpiWarnDelta', tone: 'warn' },
] as const;

const QUOTAS = [
  { key: 'sys.c.quotaUsers', used: 48, limit: 60, text: '48 / 60' },
  { key: 'sys.c.quotaStorage', used: 184.2, limit: 200, text: '184,2 / 200 GB' },
  { key: 'sys.c.quotaSigns', used: 1120, limit: 1500, text: '1 120 / 1 500' },
] as const;

interface ModuleSample {
  abbr: string;
  name: string;
  version: string;
  users: number;
  on: boolean;
}

const MODULES: readonly ModuleSample[] = [
  { abbr: 'PG', name: 'Pagarés', version: '1.4', users: 48, on: true },
  { abbr: 'CI', name: 'Consentimiento informado', version: '1.2', users: 12, on: true },
  { abbr: 'BR', name: 'Bienes raíces', version: '1.0', users: 7, on: true },
  { abbr: 'IN', name: 'Integraciones v2', version: '2.0', users: 0, on: false },
];

const FILTERS: readonly FilterPill[] = [
  { key: 'all', labelKey: 'sys.c.fAll', count: 312 },
  { key: 'active', labelKey: 'org.state.active', count: 6 },
  { key: 'trial', labelKey: 'org.state.trial', count: 2 },
  { key: 'warning', labelKey: 'org.state.warning', count: 2 },
  { key: 'suspended', labelKey: 'org.state.suspended', count: 1 },
];

@Component({
  selector: 'dba-design-system',
  imports: [
    TranslatePipe,
    ButtonComponent,
    FieldComponent,
    KpiCardComponent,
    QuotaBarComponent,
    ModuleToggleComponent,
    AuditEventComponent,
    FilterPillsComponent,
    OrgStateComponent,
    RoleTagComponent,
    EnvPillComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sys">
      <header class="sys__head">
        <span class="dba-eyebrow">{{ 'shell.product' | translate }} · F0</span>
        <h1 class="dba-section">{{ 'sys.title' | translate }}</h1>
        <p class="dba-body sys__lead">{{ 'sys.lead' | translate }}</p>
      </header>

      <section class="sys__block">
        <h2 class="dba-eyebrow sys__eyebrow">{{ 'sys.ramp' | translate }}</h2>
        <div class="ramp">
          @for (step of ramp; track step[0]) {
            <div class="ramp__step">
              <span class="ramp__swatch" [style.background]="step[1]"></span>
              <span class="ramp__n" [class.ramp__n--primary]="step[0] === '500'">{{ step[0] }}</span>
              <span class="ramp__hex">{{ step[1] }}</span>
            </div>
          }
        </div>
      </section>

      <section class="sys__cols">
        <div class="sys__block">
          <h2 class="dba-eyebrow sys__eyebrow">{{ 'sys.states' | translate }}</h2>
          @for (state of states; track state.key) {
            <div class="row">
              <dba-org-state [state]="state.key" />
              <span class="dba-body">{{ state.descKey | translate }}</span>
            </div>
          }
          <p class="dba-meta sys__note">{{ 'sys.statesNote' | translate }}</p>
        </div>
        <div class="sys__block">
          <h2 class="dba-eyebrow sys__eyebrow">{{ 'sys.roles' | translate }}</h2>
          @for (role of roles; track role.key) {
            <div class="row">
              <dba-role-tag [role]="role.key" />
              <span class="dba-body">{{ role.descKey | translate }}</span>
            </div>
          }
          <p class="sys__forbidden">{{ 'sys.forbidden' | translate }}</p>
        </div>
      </section>

      <section class="sys__block">
        <h2 class="dba-eyebrow sys__eyebrow">{{ 'sys.type' | translate }}</h2>
        <p class="dba-body sys__lead">{{ 'sys.typeNote' | translate }}</p>
        <div class="type">
          @for (sample of samples; track sample.tag) {
            <div class="type__row">
              <span class="dba-meta type__tag">{{ sample.tag }}</span>
              <span [class]="sample.cls">{{ sample.key | translate }}</span>
            </div>
          }
        </div>
      </section>

      <section class="sys__components">
        <header class="sys__head">
          <h2 class="dba-section">{{ 'sys.components' | translate }}</h2>
          <p class="dba-body sys__lead">{{ 'sys.componentsNote' | translate }}</p>
        </header>

        <div class="cards">
          <div class="card">
            <h3 class="dba-eyebrow">{{ 'sys.c.actions' | translate }}</h3>
            <div class="card__row">
              <button dba-button block>{{ 'common.save' | translate }}</button>
              <button dba-button variant="secondary" block>{{ 'common.cancel' | translate }}</button>
            </div>
            <div class="card__row">
              <button dba-button variant="dark" block>
                {{ 'sys.c.openFile' | translate }}
                <span class="dba-btn-id">ORG-0412</span>
              </button>
              <button dba-button variant="secondary" iconOnly [attr.aria-label]="'sys.c.more' | translate">
                <db-icon name="moreVertical" [size]="15" />
              </button>
            </div>
            <button dba-button variant="destructive" block>{{ 'sys.c.suspend' | translate }}</button>

            <h3 class="dba-eyebrow card__eyebrow">{{ 'sys.c.field' | translate }}</h3>
            <dba-field label="sys.c.domainLabel" [(value)]="domain" badge="sys.c.dnsOk" badgeTone="ok" />

            <h3 class="dba-eyebrow card__eyebrow">{{ 'sys.c.challenge' | translate }}</h3>
            <div class="card__row">
              <button dba-button variant="secondary" class="challenge" (click)="tryChallenge()">
                {{ 'sys.c.tryChallenge' | translate }}
              </button>
              @if (challengeResult(); as result) {
                <span class="dba-meta challenge__result">{{ result | translate }}</span>
              }
            </div>
          </div>

          <div class="card">
            <h3 class="dba-eyebrow">{{ 'sys.c.kpi' | translate }}</h3>
            <div class="card__grid2">
              @for (kpi of kpis; track kpi.key) {
                <dba-kpi-card dense [label]="kpi.key" [value]="kpi.value" [delta]="kpi.delta | translate" [deltaTone]="kpi.tone" />
              }
            </div>

            <h3 class="dba-eyebrow card__eyebrow">{{ 'sys.c.quota' | translate }}</h3>
            <div class="card__stack">
              @for (quota of quotas; track quota.key) {
                <dba-quota-bar [label]="quota.key" [used]="quota.used" [limit]="quota.limit" [valueText]="quota.text" />
              }
            </div>
            <p class="dba-body">{{ 'sys.c.quotaNote' | translate }}</p>
          </div>

          <div class="card">
            <h3 class="dba-eyebrow">{{ 'sys.c.modules' | translate }}</h3>
            <div class="card__list">
              @for (mod of modules(); track mod.abbr) {
                <dba-module-toggle
                  [abbr]="mod.abbr"
                  [name]="mod.name"
                  [meta]="
                    mod.on ? ('sys.c.modMeta' | translate: { version: mod.version, n: mod.users }) : ('sys.c.modNotContracted' | translate)
                  "
                  [on]="mod.on"
                  (toggled)="toggleModule(mod.abbr, $event)"
                />
              }
            </div>

            <h3 class="dba-eyebrow card__eyebrow">{{ 'sys.c.audit' | translate }}</h3>
            <div class="card__events">
              <dba-audit-event actor="Marta Vidal" meta="03-oct-2026 16:42 UTC · ip 10.4.1.18 · evt 8f3a…c21d">
                {{ 'sys.c.ev1a' | translate }} <code class="dba-ref">ORG-0412</code> {{ 'sys.c.ev1b' | translate }}
              </dba-audit-event>
              <dba-audit-event kind="system" [actor]="'sys.c.system' | translate" meta="28-sep-2026 09:00 UTC · evt 71bb…0e4f">
                {{ 'sys.c.ev2' | translate }}
              </dba-audit-event>
              <dba-audit-event actor="Lucía Paredes" meta="21-sep-2026 11:18 UTC · evt 02c9…aa10">
                {{ 'sys.c.ev3' | translate }}
              </dba-audit-event>
              <dba-audit-event kind="support" [actor]="'sys.c.supportActor' | translate" meta="14-sep-2026 15:05 UTC · evt e5d1…77b2" last>
                {{ 'sys.c.ev4' | translate }} <code class="dba-ref">ORG-0412</code>
              </dba-audit-event>
            </div>

            <h3 class="dba-eyebrow card__eyebrow">{{ 'sys.c.filters' | translate }}</h3>
            <db-filter-pills [pills]="filters" [active]="filter()" (activeChange)="filter.set($event)" />
          </div>

          <div class="card">
            <h3 class="dba-eyebrow">{{ 'sys.c.pills' | translate }}</h3>
            <div class="card__row card__row--wrap">
              <dba-env-pill env="production" />
              <dba-env-pill env="canary" />
              <dba-env-pill env="dev" />
            </div>
            <div class="card__row card__row--wrap">
              @for (state of states; track state.key) {
                <dba-org-state [state]="state.key" variant="inline" />
              }
            </div>
            <p class="dba-body">{{ 'sys.c.pillsNote' | translate }}</p>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: `
    .sys {
      max-width: var(--dba-grid-width);
      margin: 0 auto;
      padding: var(--dba-grid-margin);
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .sys__head {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .sys__lead {
      max-width: 64ch;
    }

    .sys__block {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .sys__eyebrow {
      margin: 0 0 8px;
    }

    .sys__note {
      margin: 12px 0 0;
    }

    .sys__cols {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--dba-grid-gap);
    }

    .sys__forbidden {
      margin: 12px 0 0;
      padding: 10px 12px;
      border: 1px solid var(--dba-state-suspended-border);
      border-radius: var(--dba-radius-control);
      background: var(--dba-state-suspended-bg);
      font-size: var(--dba-text-label);
      color: var(--dba-state-suspended-fg);
    }

    .sys__components {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .ramp {
      display: grid;
      grid-template-columns: repeat(11, minmax(0, 1fr));
      gap: 6px;
    }

    .ramp__step {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    .ramp__swatch {
      display: block;
      height: 44px;
      border-radius: var(--dba-radius-control);
      border: 1px solid var(--dba-border-row);
    }

    .ramp__n {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-micro);
      color: var(--dba-text-muted);
    }

    .ramp__n--primary {
      font-weight: 700;
      color: var(--dba-violet-500);
    }

    .ramp__hex {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-th);
      color: var(--dba-text-faint);
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .row {
      display: grid;
      grid-template-columns: 130px minmax(0, 1fr);
      gap: 12px;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid var(--dba-border-row);
    }

    .row:last-of-type {
      border-bottom: 0;
    }

    .type {
      display: flex;
      flex-direction: column;
    }

    .type__row {
      display: grid;
      grid-template-columns: 110px minmax(0, 1fr);
      gap: 16px;
      align-items: baseline;
      padding: 12px 0;
      border-bottom: 1px solid var(--dba-border-row);
    }

    .type__row:last-child {
      border-bottom: 0;
    }

    .sys__menu {
      font-size: var(--dba-text-body);
      font-weight: 600;
      color: var(--dba-ink);
      border-bottom: 2px solid var(--dba-violet-500);
      padding-bottom: 4px;
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 18px;
    }

    .card {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .card__eyebrow {
      margin-top: 6px;
    }

    .card__row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .card__row--wrap {
      flex-wrap: wrap;
      gap: 10px 14px;
    }

    .card__grid2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .card__stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .card__list {
      display: flex;
      flex-direction: column;
      gap: 1px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-card);
      background: var(--dba-border-card);
      overflow: hidden;
    }

    .card__events {
      display: flex;
      flex-direction: column;
      padding: 12px 14px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-card);
    }

    .challenge {
      flex: none;
    }

    .challenge__result {
      min-width: 0;
    }

    @media (max-width: 760px) {
      .sys {
        padding: 24px 16px;
      }

      .sys__cols {
        grid-template-columns: 1fr;
      }

      .ramp {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .row,
      .type__row {
        grid-template-columns: 1fr;
        gap: 6px;
      }

      .cards {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class DesignSystemComponent {
  private readonly dialogs = inject(DialogService);

  protected readonly ramp = RAMP;
  protected readonly states = ORG_STATES;
  protected readonly roles = PLATFORM_ROLES;
  protected readonly samples = TYPE_SAMPLES;
  protected readonly kpis = KPIS;
  protected readonly quotas = QUOTAS;
  protected readonly filters = FILTERS;

  protected readonly domain = signal('sierranorte.aero');
  protected readonly modules = signal(MODULES);
  protected readonly filter = signal('all');
  protected readonly challengeResult = signal('');

  protected toggleModule(abbr: string, on: boolean): void {
    this.modules.update((list) => list.map((mod) => (mod.abbr === abbr ? { ...mod, on } : mod)));
  }

  protected async tryChallenge(): Promise<void> {
    const result = await this.dialogs.open({
      intent: 'danger',
      icon: 'triangleAlert',
      title: 'sys.c.suspendTitle',
      message: 'sys.c.suspendMessage',
      confirmLabel: 'sys.c.suspend',
      challenge: { identifier: 'ORG-0412', actionKey: 'sys.c.suspendVerb' },
    });
    this.challengeResult.set(result.answer === 'confirm' ? 'sys.c.confirmed' : 'sys.c.cancelled');
  }
}

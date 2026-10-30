import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DialogService } from '../../../core/ui/dialog.service';
import { DensityService } from '../../../core/preferences/density.service';
import { ORG_STATES, quotaToneOf } from '../../../shared/domain/org-state';
import { PLATFORM_ROLES } from '../../../shared/domain/platform-role';
import { sectionPath } from '../../../core/layout/console-nav';
import { ActionRowComponent } from '../../../shared/ui/action-row.component';
import { AuditEventComponent } from '../../../shared/ui/audit-event.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { RecordHeaderComponent } from '../../../shared/ui/record-header.component';
import { UnderlineTabsComponent, type UnderlineTab } from '../../../shared/ui/underline-tabs.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { EnvPillComponent } from '../../../shared/ui/env-pill.component';
import { FieldComponent } from '../../../shared/ui/field.component';
import { FilterPillsComponent, type FilterPill } from '../../../shared/ui/filter-pills.component';
import { ActionMenuComponent, type ActionMenuItem } from '../../../shared/ui/action-menu.component';
import { OrgFlagComponent } from '../../../shared/ui/org-flag.component';
import { NavGroupComponent, type NavGroupLink } from '../../../shared/ui/nav-group.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { KpiCardComponent } from '../../../shared/ui/kpi-card.component';
import { ModuleToggleComponent } from '../../../shared/ui/module-toggle.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { QuotaBarComponent } from '../../../shared/ui/quota-bar.component';
import { UsageMeterComponent } from '../../../shared/ui/usage-meter.component';
import { TierEditorComponent } from '../../../shared/ui/tier-editor.component';
import { TextAreaComponent } from '../../../shared/ui/text-area.component';
import type { TierDraft } from '../../../shared/domain/price-tiers';
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

const NAV_LINKS: readonly NavGroupLink[] = [
  { key: 'organizations', labelKey: 'nav.organizations', path: '/clientes/organizaciones', count: 9 },
  { key: 'users', labelKey: 'nav.users', path: '/clientes/usuarios' },
  { key: 'signers', labelKey: 'nav.signers', path: '/clientes/firmantes' },
  { key: 'legalEntities', labelKey: 'nav.legalEntities', path: '/clientes/juridicas' },
];

const NAV_LINKS_QUIET: readonly NavGroupLink[] = [
  { key: 'plans', labelKey: 'nav.plans', path: '/comercial/planes' },
  { key: 'billing', labelKey: 'nav.billing', path: '/comercial/facturacion' },
];

const FILTERS: readonly FilterPill[] = [
  { key: 'all', labelKey: 'sys.c.fAll', count: 312 },
  { key: 'active', labelKey: 'org.state.active', count: 6 },
  { key: 'trial', labelKey: 'org.state.trial', count: 2 },
  { key: 'warning', labelKey: 'org.state.warning', count: 2 },
  { key: 'suspended', labelKey: 'org.state.suspended', count: 1 },
];

interface OrgSeed {
  id: string;
  name: string;
  domain: string;
  plan: string;
  users: number;
  userLimit: number;
  gb: number;
  gbLimit: number;
  state: string;
}

const ORGS: readonly OrgSeed[] = [
  { id: 'ORG-0412', name: 'Aeropuerto Sierra Norte', domain: 'sierranorte.aero', plan: 'Corporativo', users: 48, userLimit: 60, gb: 184.2, gbLimit: 200, state: 'active' },
  { id: 'ORG-0398', name: 'Clínica Santa Rita', domain: 'santarita.es', plan: 'Equipo', users: 22, userLimit: 25, gb: 41, gbLimit: 100, state: 'active' },
  { id: 'ORG-0405', name: 'Grupo Logístico Andino', domain: 'gla.com.pe', plan: 'Corporativo', users: 131, userLimit: 150, gb: 96.4, gbLimit: 500, state: 'active' },
  { id: 'ORG-0419', name: 'Notaría 14 de Bogotá', domain: 'notaria14.co', plan: 'Prueba', users: 4, userLimit: 10, gb: 2.1, gbLimit: 20, state: 'trial' },
  { id: 'ORG-0377', name: 'Puerto de Valparaíso', domain: 'puertovalpo.cl', plan: 'Corporativo', users: 77, userLimit: 80, gb: 403, gbLimit: 400, state: 'warning' },
  { id: 'ORG-0351', name: 'Banca Cooperativa del Sur', domain: 'bcsur.coop', plan: 'Corporativo', users: 210, userLimit: 250, gb: 512.6, gbLimit: 1000, state: 'active' },
  { id: 'ORG-0402', name: 'Textiles Herrera', domain: 'textilesherrera.mx', plan: 'Equipo', users: 12, userLimit: 25, gb: 18.7, gbLimit: 100, state: 'suspended' },
  { id: 'ORG-0388', name: 'Universidad del Litoral', domain: 'unilitoral.edu.ar', plan: 'Equipo', users: 25, userLimit: 25, gb: 88.9, gbLimit: 100, state: 'warning' },
  { id: 'ORG-0420', name: 'Despacho Riaño Abogados', domain: 'riano.legal', plan: 'Prueba', users: 2, userLimit: 10, gb: 0.4, gbLimit: 20, state: 'trial' },
  { id: 'ORG-0290', name: 'Minera Cerro Blanco', domain: 'cerroblanco.cl', plan: 'Corporativo', users: 0, userLimit: 60, gb: 0, gbLimit: 200, state: 'closed' },
];

const ORG_COLUMNS: readonly DataColumn[] = [
  { key: 'id', labelKey: 'org.col.id', width: '84px' },
  { key: 'org', labelKey: 'org.col.name', width: 'minmax(0, 1.6fr)' },
  { key: 'plan', labelKey: 'org.col.plan', width: '110px' },
  { key: 'users', labelKey: 'org.col.users', width: '150px' },
  { key: 'storage', labelKey: 'org.col.storage', width: '170px' },
  { key: 'state', labelKey: 'org.col.state', width: '120px' },
  { key: 'chevron', width: '40px', align: 'end' },
];

const ORG_TAB_KEYS = ['summary', 'users', 'modules', 'plan', 'security', 'audit'] as const;

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

const gbText = (value: number): string =>
  `${Number.isInteger(value) ? String(value) : String(value).replace('.', ',')} GB`;

const pctOf = (used: number, limit: number): string =>
  `${limit > 0 ? Math.min(100, (used / limit) * 100) : 0}%`;

@Component({
  selector: 'dba-design-system',
  imports: [
    NavGroupComponent,
    ActionMenuComponent,
    OrgFlagComponent,
    TranslatePipe,
    ButtonComponent,
    FieldComponent,
    KpiCardComponent,
    QuotaBarComponent,
    UsageMeterComponent,
    TierEditorComponent,
    TextAreaComponent,
    ModuleToggleComponent,
    AuditEventComponent,
    ActionRowComponent,
    FilterPillsComponent,
    OrgStateComponent,
    RoleTagComponent,
    EnvPillComponent,
    IconComponent,
    DataTableComponent,
    RecordHeaderComponent,
    UnderlineTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sys">
      <header class="sys__head">
        <span class="dba-eyebrow">{{ 'nav.system' | translate }} · F0</span>
        <h1 class="dba-page">{{ 'sys.title' | translate }}</h1>
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

            <h3 class="dba-eyebrow card__eyebrow">{{ 'sys.c.usage' | translate }}</h3>
            <div class="card__stack">
              <dba-usage-meter [used]="42" [limit]="100" />
              <dba-usage-meter [used]="190" [limit]="200" />
              <dba-usage-meter [used]="210" [limit]="200" />
              <dba-usage-meter [used]="7" [limit]="null" />
            </div>
            <p class="dba-body">{{ 'sys.c.usageNote' | translate }}</p>
          </div>

          <div class="card">
            <h3 class="dba-eyebrow">{{ 'sys.c.tiers' | translate }}</h3>
            <dba-tier-editor [(tiers)]="sampleTiers" />
            <p class="dba-body">{{ 'sys.c.tiersNote' | translate }}</p>

            <h3 class="dba-eyebrow card__eyebrow">{{ 'sys.c.textArea' | translate }}</h3>
            <dba-text-area
              label="sys.c.textAreaLabel"
              hint="sys.c.textAreaHint"
              [maxlength]="300"
              [(value)]="sampleText"
            />
            <p class="dba-body">{{ 'sys.c.textAreaNote' | translate }}</p>
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

            <h3 class="dba-eyebrow card__eyebrow">{{ 'sys.c.actionRow' | translate }}</h3>
            <div class="card__rows">
              <dba-action-row tone="bad" reference="900123456" subject="Puerto de Valparaíso" [text]="'sys.c.ar1' | translate" [cta]="'sys.c.arCta' | translate" [link]="orgsPath" />
              <dba-action-row tone="warn" reference="800456789" subject="Notaría 14 de Bogotá" [text]="'sys.c.ar2' | translate" [cta]="'sys.c.arCta' | translate" [link]="orgsPath" />
              <dba-action-row tone="warn" reference="901234567" subject="Universidad del Litoral" [text]="'sys.c.ar3' | translate" [cta]="'sys.c.arCta' | translate" [link]="orgsPath" />
            </div>
            <p class="dba-body">{{ 'sys.c.actionRowNote' | translate }}</p>

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
              <dba-org-flag kind="reseller" />
              <dba-org-flag kind="test" />
            </div>
            <div class="card__row card__row--wrap">
              @for (state of states; track state.key) {
                <dba-org-state [state]="state.key" variant="inline" />
              }
            </div>
            <p class="dba-body">{{ 'sys.c.pillsNote' | translate }}</p>
          </div>

          <div class="card">
            <h3 class="dba-eyebrow">{{ 'sys.c.navGroup' | translate }}</h3>
            <div class="card__row nav-demo">
              <dba-nav-group labelKey="nav.group.clients" [links]="navLinks" [active]="true" />
              <dba-nav-group labelKey="nav.group.commercial" [links]="navLinksQuiet" />
            </div>
            <div class="nav-demo__drawer">
              <dba-nav-group variant="drawer" labelKey="nav.group.clients" [links]="navLinks" [active]="true" />
            </div>
            <p class="dba-body">{{ 'sys.c.navGroupNote' | translate }}</p>
          </div>

          <div class="card">
            <h3 class="dba-eyebrow">{{ 'sys.c.actionMenu' | translate }}</h3>
            <div class="card__row">
              <button dba-button variant="secondary" (click)="actionDemo.toggle($event)">{{ 'sys.c.actions' | translate }}</button>
              <dba-action-menu #actionDemo label="sys.c.actions" [items]="actionItems" (picked)="actionPicked.set($event)" />
              @if (actionPicked()) {
                <span class="dba-meta">{{ 'sys.c.actionPicked' | translate: { key: actionPicked() } }}</span>
              }
            </div>
            <p class="dba-body">{{ 'sys.c.actionMenuNote' | translate }}</p>
          </div>
        </div>
      </section>

      <section class="sys__components">
        <header class="sys__head">
          <h2 class="dba-section">{{ 'sys.pieces' | translate }}</h2>
          <p class="dba-body sys__lead">{{ 'sys.piecesNote' | translate }}</p>
        </header>

        <dba-record-header
          [crumbs]="recordCrumbs"
          initials="SN"
          title="Aeropuerto Sierra Norte"
          state="active"
          meta="ORG-0412 · sierranorte.aero · Corporativo · alta 14/03/2024"
        >
          <div actions class="rec-actions">
            <button dba-button variant="secondary">{{ 'org.edit' | translate }}</button>
            <button dba-button variant="secondary" iconOnly [attr.aria-label]="'sys.c.more' | translate">
              <db-icon name="moreVertical" [size]="15" />
            </button>
          </div>
        </dba-record-header>

        <db-underline-tabs [tabs]="recordTabs()" [active]="tab()" (picked)="tab.set($event)" />

        <dba-data-table
          [columns]="orgColumns"
          [label]="'nav.organizations' | translate"
          [dense]="density.compact()"
          minWidth="820px"
          [total]="312"
          [from]="1"
          [to]="10"
          [page]="page()"
          [pageCount]="32"
          (pageChange)="page.set($event)"
        >
          @for (row of rows(); track row.id) {
            <button type="button" class="dba-tr" [class.dba-tr--on]="row.id === selected()" (click)="selected.set(row.id)">
              <code class="dba-td org-id" [class.org-id--on]="row.id === selected()">{{ row.id }}</code>
              <div class="dba-td org-cell">
                <span class="org-cell__avatar" aria-hidden="true">{{ row.initials }}</span>
                <span class="org-cell__text">
                  <span class="org-cell__name" [class.org-cell__name--on]="row.id === selected()">{{ row.name }}</span>
                  <span class="org-cell__domain">{{ row.domain }}</span>
                </span>
              </div>
              <span class="dba-td org-plan">{{ row.plan }}</span>
              <span class="dba-td usage">
                <code class="usage__value">{{ row.usersText }}</code>
                <span class="usage__track"><span class="usage__fill" [class]="'usage__fill usage__fill--' + row.usersTone" [style.width]="row.usersPct"></span></span>
              </span>
              <span class="dba-td usage">
                <code class="usage__value usage__value--wide">{{ row.gbText }}</code>
                <span class="usage__track"><span class="usage__fill" [class]="'usage__fill usage__fill--' + row.gbTone" [style.width]="row.gbPct"></span></span>
              </span>
              <dba-org-state class="dba-td" [state]="row.state" variant="inline" />
              <db-icon class="dba-td dba-td--end org-chevron" name="chevronRight" [size]="15" />
            </button>
          }
        </dba-data-table>
      </section>
    </div>
  `,
  styles: `
    .sys {
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
      position: relative;
      font-size: var(--dba-text-body);
      font-weight: 600;
      color: var(--dba-ink);
      padding-bottom: 6px;
    }

    .sys__menu::after {
      content: '';
      position: absolute;
      inset: auto 0 0;
      height: 2px;
      background: var(--dba-violet-500);
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

    .nav-demo {
      height: 44px;
      align-items: stretch;
      border-bottom: 1px solid var(--dba-border-row);
    }

    .nav-demo__drawer {
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-width: 288px;
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

    .card__rows {
      overflow: hidden;
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
    .rec-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .org-id {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-small);
      color: var(--dba-text-muted);
    }

    .org-id--on {
      color: var(--dba-violet-700);
    }

    .org-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .org-cell__avatar {
      display: flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: var(--dba-radius-avatar);
      background: var(--dba-violet-100);
      font-size: var(--dba-text-eyebrow);
      font-weight: 700;
      color: var(--dba-violet-700);
    }

    .org-cell__text {
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .org-cell__name {
      font-size: var(--dba-text-cell);
      font-weight: 500;
      color: var(--dba-ink);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .org-cell__name--on {
      font-weight: 600;
    }

    .org-cell__domain {
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .org-plan {
      font-size: var(--dba-text-label);
      color: var(--dba-text);
    }

    .usage {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .usage__value {
      flex: none;
      width: 58px;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-small);
      color: var(--dba-text);
      white-space: nowrap;
    }

    .usage__value--wide {
      width: 70px;
    }

    .usage__track {
      flex: 1;
      display: flex;
      height: 5px;
      border-radius: var(--dba-radius-bar);
      background: var(--dba-border-row);
      overflow: hidden;
    }

    .usage__fill {
      background: var(--dba-quota-ok);
    }

    .usage__fill--warn {
      background: var(--dba-quota-warn);
    }

    .usage__fill--over {
      background: var(--dba-quota-over);
    }

    .org-chevron {
      color: var(--dba-text-faint);
    }
  `,
})
export class DesignSystemComponent {
  protected readonly orgsPath = sectionPath('organizations');
  private readonly dialogs = inject(DialogService);
  private readonly translate = inject(TranslateService);
  protected readonly density = inject(DensityService);

  protected readonly ramp = RAMP;
  protected readonly states = ORG_STATES;
  protected readonly roles = PLATFORM_ROLES;
  protected readonly samples = TYPE_SAMPLES;
  protected readonly kpis = KPIS;
  protected readonly quotas = QUOTAS;
  protected readonly filters = FILTERS;
  protected readonly navLinks = NAV_LINKS;
  protected readonly actionItems: readonly ActionMenuItem[] = [
    { key: 'role', labelKey: 'staff.action.role' },
    { key: 'suspend', labelKey: 'staff.action.suspend' },
    { key: 'remove', labelKey: 'staff.action.remove', danger: true, separated: true },
  ];
  protected readonly actionPicked = signal('');
  protected readonly navLinksQuiet = NAV_LINKS_QUIET;
  protected readonly orgColumns = ORG_COLUMNS;
  protected readonly recordCrumbs = ['nav.crumbRoot', 'nav.organizations', 'ORG-0412'];

  protected readonly domain = signal('sierranorte.aero');
  protected readonly modules = signal(MODULES);
  protected readonly sampleTiers = signal<TierDraft[]>([
    { minQuantity: '100', discountPct: '5' },
    { minQuantity: '500', discountPct: '12' },
  ]);
  protected readonly sampleText = signal('');
  protected readonly filter = signal('all');
  protected readonly challengeResult = signal('');
  protected readonly selected = signal('ORG-0412');
  protected readonly page = signal(1);
  protected readonly tab = signal('summary');

  protected readonly recordTabs = computed<UnderlineTab[]>(() =>
    ORG_TAB_KEYS.map((key) => ({ key, label: this.translate.instant('org.tab.' + key) as string })),
  );

  protected readonly rows = computed(() =>
    ORGS.map((org) => ({
      id: org.id,
      name: org.name,
      domain: org.domain,
      initials: initialsOf(org.name),
      plan: org.plan,
      state: org.state,
      usersText: `${org.users} / ${org.userLimit}`,
      usersTone: quotaToneOf(org.users, org.userLimit),
      usersPct: pctOf(org.users, org.userLimit),
      gbText: gbText(org.gb),
      gbTone: quotaToneOf(org.gb, org.gbLimit),
      gbPct: pctOf(org.gb, org.gbLimit),
    })),
  );

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

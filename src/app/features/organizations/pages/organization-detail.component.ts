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
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { LatestRequest } from '../../../shared/http/latest-request';
import { AuthStore } from '../../../core/auth/auth.store';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { errorCodeOf } from '../../../shared/http/error-code';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgFlagComponent } from '../../../shared/ui/org-flag.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ModuleToggleComponent } from '../../../shared/ui/module-toggle.component';
import { QuotaBarComponent } from '../../../shared/ui/quota-bar.component';
import { RecordHeaderComponent } from '../../../shared/ui/record-header.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { UnderlineTabsComponent, type UnderlineTab } from '../../../shared/ui/underline-tabs.component';
import { OrgProfileFormComponent } from '../components/org-profile-form.component';
import { ResellerPickerComponent } from '../components/reseller-picker.component';
import { MembersTabComponent } from '../components/members/members-tab.component';
import { IntegrationsTabComponent } from '../components/integrations/integrations-tab.component';
import { ValidationsTabComponent } from '../components/validations/validations-tab.component';
import { QuotasTabComponent } from '../components/quotas/quotas-tab.component';
import { SubscriptionTabComponent } from '../components/subscription/subscription-tab.component';
import { OrgPurgeComponent } from '../components/purge/org-purge.component';
import { OrganizationsApi } from '../data/organizations.api';
import type { PlatformOrgDetail, PlatformOrgUpdate } from '../data/organizations.models';
import { orgStateView } from '../data/platform-org-state';

const TAB_KEYS = [
  'summary',
  'subscription',
  'quotas',
  'members',
  'integrations',
  'validations',
  'marketplace',
  'documents',
  'audit',
] as const;

const MODULES = [
  { code: 'pagares', abbr: 'PG', labelKey: 'orgd.module.pagares' },
  { code: 'consentimiento_informado', abbr: 'CI', labelKey: 'orgd.module.consent' },
  { code: 'bienes_raices', abbr: 'BR', labelKey: 'orgd.module.realEstate' },
] as const;

const ORG_EDIT_ERRORS = ['TRIBUTARY_NUMBER_INVALID', 'NIT_EN_USO', 'CIUDAD_FUERA_DEL_PAIS', 'ORG_NO_EXISTE'];

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || name.slice(0, 2).toUpperCase();

@Component({
  selector: 'dba-organization-detail',
  imports: [
    TranslatePipe,
    RecordHeaderComponent,
    UnderlineTabsComponent,
    QuotaBarComponent,
    ModuleToggleComponent,
    EmptyStateComponent,
    SectionLoaderComponent,
    ButtonComponent,
    IconComponent,
    OrgFlagComponent,
    OrgProfileFormComponent,
    ResellerPickerComponent,
    SubscriptionTabComponent,
    QuotasTabComponent,
    MembersTabComponent,
    ValidationsTabComponent,
    IntegrationsTabComponent,
    OrgPurgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'orgd.loading' | translate" />
    } @else if (error()) {
      <div class="od__panel">
        <dba-empty-state titleKey="orgd.errorTitle" leadKey="orgd.errorLead" />
        <button dba-button variant="secondary" (click)="reload()">{{ 'common.retry' | translate }}</button>
      </div>
    } @else if (detail(); as org) {
      <div class="od">
        <dba-record-header
          [initials]="initials()"
          [title]="org.businessName"
          [state]="stateFamily()"
          [stateLabelKey]="stateLabel()"
          [meta]="meta()"
        >
          <div actions class="od__flags">
            @if (org.isReseller) {
              <dba-org-flag kind="reseller" />
            }
            @if (org.isTest) {
              <dba-org-flag kind="test" />
            }
            @if (canEdit()) {
              <button dba-button variant="secondary" (click)="editing.set(true)">
                <db-icon name="pencil" [size]="15" />
                {{ 'orgEdit.open' | translate }}
              </button>
              @if (org.state === 'suspended') {
                <button dba-button variant="secondary" [busy]="switching()" (click)="reactivate(org)">
                  {{ 'orgState.reactivate' | translate }}
                </button>
              } @else {
                <button dba-button variant="destructive" [busy]="switching()" (click)="suspend(org)">
                  {{ 'orgState.suspend' | translate }}
                </button>
              }
            }
            @if (org.isTest && canPurge()) {
              <button dba-button variant="destructive" (click)="purging.set(true)">
                <db-icon name="trash" [size]="15" />
                {{ 'purge.open' | translate }}
              </button>
            }
          </div>
        </dba-record-header>

        <db-underline-tabs [tabs]="tabs()" [active]="tab()" (picked)="tab.set($event)" />

        @if (tab() === 'summary') {
          <div class="od__cols">
            <div class="od__side">
              <section class="od__card">
                <h2 class="dba-panel">{{ 'orgd.profile' | translate }}</h2>
                <dl class="od__dl">
                  <dt>{{ 'orgd.f.nit' | translate }}</dt>
                  <dd class="dba-mono">{{ org.tributaryNumber }}</dd>
                  <dt>{{ 'orgd.f.country' | translate }}</dt>
                  <dd>{{ org.countryName || '—' }}</dd>
                  <dt>{{ 'orgd.f.city' | translate }}</dt>
                  <dd>{{ org.cityName || '—' }}</dd>
                  <dt>{{ 'orgd.f.email' | translate }}</dt>
                  <dd>{{ org.email || '—' }}</dd>
                  <dt>{{ 'orgd.f.phone' | translate }}</dt>
                  <dd>{{ org.phone || '—' }}</dd>
                  <dt>{{ 'orgd.f.address' | translate }}</dt>
                  <dd>{{ org.address || '—' }}</dd>
                  <dt>{{ 'orgd.f.web' | translate }}</dt>
                  <dd>{{ org.webSite || '—' }}</dd>
                  <dt>{{ 'orgd.f.language' | translate }}</dt>
                  <dd>{{ org.language ? ('orgEdit.lang.' + org.language | translate) : '—' }}</dd>
                  <dt>{{ 'orgd.f.constitution' | translate }}</dt>
                  <dd class="dba-mono">{{ org.constitutionDate || '—' }}</dd>
                  <dt>{{ 'orgd.f.created' | translate }}</dt>
                  <dd class="dba-mono">{{ created() }}</dd>
                  <dt>{{ 'orgd.f.reseller' | translate }}</dt>
                  <dd class="od__reseller">
                    <span>{{ org.resellerName || ('orgReseller.none' | translate) }}</span>
                    @if (canAssignReseller()) {
                      <button type="button" class="od__link" (click)="pickingReseller.set(true)">{{ 'orgReseller.change' | translate }}</button>
                    }
                  </dd>
                </dl>
              </section>

              <section class="od__card">
                <h2 class="dba-panel">{{ 'orgd.modules' | translate }}</h2>
                <div class="od__modules">
                  @for (mod of modules; track mod.code) {
                    <dba-module-toggle
                      [abbr]="mod.abbr"
                      [name]="mod.labelKey | translate"
                      [on]="has(org, mod.code)"
                      [disabled]="!canEdit() || savingModule()"
                      (toggled)="toggleModule(org, mod.code, $event)"
                    />
                  }
                </div>
              </section>
            </div>

            <div class="od__side">
              <section class="od__card">
                <h2 class="dba-panel">{{ 'orgd.planUsage' | translate }}</h2>
                @if (org.plan; as plan) {
                  <dl class="od__dl">
                    <dt>{{ 'orgd.f.plan' | translate }}</dt>
                    <dd>{{ plan.name }}</dd>
                    <dt>{{ 'orgd.f.source' | translate }}</dt>
                    <dd class="dba-mono">{{ plan.source }}</dd>
                    <dt>{{ 'orgd.f.validity' | translate }}</dt>
                    <dd class="dba-mono">{{ validity() }}</dd>
                  </dl>
                  <dba-quota-bar label="orgd.f.documents" [used]="org.documents.used" [limit]="org.documents.limit" [valueText]="docsText()" />
                } @else {
                  <p class="dba-body od__muted">{{ 'orgd.noPlan' | translate }}</p>
                }
                <dl class="od__dl od__dl--tight">
                  <dt>{{ 'orgd.f.members' | translate }}</dt>
                  <dd class="dba-mono">{{ org.members }}</dd>
                </dl>
              </section>
            </div>
          </div>
        } @else if (tab() === 'members') {
          <dba-members-tab [org]="org" />
        } @else if (tab() === 'quotas') {
          <dba-quotas-tab [org]="org" />
        } @else if (tab() === 'subscription') {
          <dba-subscription-tab [org]="org" (changed)="refresh()" />
        } @else if (tab() === 'validations') {
          <dba-validations-tab [org]="org" />
        } @else if (tab() === 'integrations') {
          <dba-integrations-tab [org]="org" />
        } @else {
          <div class="od__panel">
            <dba-empty-state titleKey="orgd.soonTitle" leadKey="orgd.soonLead" />
          </div>
        }
      </div>

      @if (pickingReseller()) {
        <dba-reseller-picker
          [org]="org"
          [noneLabel]="'orgReseller.none' | translate"
          [busy]="saving()"
          (submitted)="assignReseller($event)"
          (dismissed)="pickingReseller.set(false)"
        />
      }

      @if (purging()) {
        <dba-org-purge [org]="org" (purged)="refresh()" (dismissed)="purging.set(false)" />
      }

      @if (editing()) {
        <dba-org-profile-form [org]="org" [busy]="saving()" (submitted)="save($event)" (dismissed)="editing.set(false)" />
      }
    }
  `,
  styles: `
    .od {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .od__flags {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .od__reseller {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .od__link {
      padding: 0;
      border: 0;
      background: transparent;
      font: inherit;
      font-weight: 600;
      color: var(--dba-violet-600);
      cursor: pointer;
    }

    .od__link:hover {
      text-decoration: underline;
    }

    .od__link:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .od__cols {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
      gap: var(--dba-grid-gap);
      align-items: start;
    }

    .od__side {
      display: flex;
      flex-direction: column;
      gap: var(--dba-grid-gap);
      min-width: 0;
    }

    .od__card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .od__dl {
      display: grid;
      grid-template-columns: 140px minmax(0, 1fr);
      gap: 10px 16px;
      margin: 0;
    }

    .od__dl--tight {
      gap: 0 16px;
    }

    .od__dl dt {
      font-size: var(--dba-text-label);
      color: var(--dba-text-muted);
    }

    .od__dl dd {
      margin: 0;
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
      overflow-wrap: anywhere;
    }

    .od__modules {
      display: flex;
      flex-direction: column;
      gap: 1px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-card);
      background: var(--dba-border-card);
      overflow: hidden;
    }

    .od__muted {
      color: var(--dba-text-muted);
    }

    .od__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 24px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    @media (max-width: 860px) {
      .od__cols {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class OrganizationDetailComponent {
  readonly id = input.required<string>();

  private readonly api = inject(OrganizationsApi);
  private readonly locale = inject(LOCALE_ID);
  private readonly translate = inject(TranslateService);

  protected readonly modules = MODULES;
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly detail = signal<PlatformOrgDetail | null>(null);
  protected readonly tab = signal<string>('summary');

  protected readonly initials = computed(() => initialsOf(this.detail()?.businessName ?? ''));
  protected readonly stateFamily = computed(() =>
    this.detail() ? orgStateView(this.detail()!.state).family : 'closed',
  );
  protected readonly stateLabel = computed(() =>
    this.detail() ? orgStateView(this.detail()!.state).labelKey : '',
  );

  protected readonly tabs = computed<UnderlineTab[]>(() =>
    TAB_KEYS.map((key) => ({ key, label: this.translate.instant('orgd.tab.' + key) as string })),
  );

  protected readonly meta = computed(() => {
    const org = this.detail();
    if (!org) return '';
    const plan = org.plan?.name ?? (this.translate.instant('orgd.noPlan') as string);
    return [org.tributaryNumber, org.countryName, plan, this.created()]
      .filter((part) => !!part)
      .join(' · ');
  });

  protected readonly created = computed(() => this.day(this.detail()?.createdAt));
  protected readonly validity = computed(() => {
    const end = this.detail()?.plan?.periodEnd;
    return end ? this.day(end) : (this.translate.instant('orgd.noExpiry') as string);
  });
  protected readonly docsText = computed(() => {
    const docs = this.detail()?.documents;
    if (!docs) return '';
    return `${docs.used} / ${docs.limit === null ? '∞' : docs.limit}`;
  });

  private readonly latest = new LatestRequest();
  private readonly auth = inject(AuthStore);
  private readonly notify = inject(NotificationService);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly canEdit = computed(() => this.auth.canManage('clients'));
  protected readonly canAssignReseller = computed(() => this.auth.canManage('commercial'));
  protected readonly switching = signal(false);
  protected readonly savingModule = signal(false);
  protected readonly pickingReseller = signal(false);
  protected readonly canPurge = computed(() => this.auth.canManage('platform'));
  protected readonly purging = signal(false);
  private readonly dialogs = inject(DialogService);

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.load(id);
    });
  }

  protected has(org: PlatformOrgDetail, code: string): boolean {
    return org.modules.includes(code);
  }

  protected async suspend(org: PlatformOrgDetail): Promise<void> {
    const answer = await this.dialogs.open({
      intent: 'danger',
      icon: 'triangleAlert',
      title: 'orgState.suspendTitle',
      message: 'orgState.suspendMessage',
      params: { name: org.businessName },
      confirmLabel: 'orgState.suspend',
      reason: { labelKey: 'orgState.reasonLabel', placeholder: 'orgState.reasonPlaceholder', limit: 500, quick: [], required: true },
      challenge: { identifier: org.tributaryNumber, actionKey: 'orgState.suspendVerb' },
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    await this.applyState(this.api.suspend(org.id, answer.reason), 'orgState.suspended');
  }

  protected async reactivate(org: PlatformOrgDetail): Promise<void> {
    const answer = await this.dialogs.open({
      intent: 'primary',
      icon: 'circleCheck',
      title: 'orgState.reactivateTitle',
      message: 'orgState.reactivateMessage',
      params: { name: org.businessName },
      confirmLabel: 'orgState.reactivate',
      reason: { labelKey: 'orgState.reasonLabel', placeholder: 'orgState.reasonPlaceholder', limit: 500, quick: [], required: true },
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    await this.applyState(this.api.reactivate(org.id, answer.reason), 'orgState.reactivated');
  }

  protected async toggleModule(org: PlatformOrgDetail, code: string, on: boolean): Promise<void> {
    const modules = on ? [...new Set([...org.modules, code])] : org.modules.filter((m) => m !== code);
    this.savingModule.set(true);
    try {
      await firstValueFrom(this.api.setModules(org.id, modules));
      this.detail.update((current) => (current ? { ...current, modules } : current));
      this.notify.success(this.translate.instant(on ? 'orgModules.on' : 'orgModules.off') as string);
    } catch {
      this.notify.error(this.translate.instant('orgModules.error') as string);
    } finally {
      this.savingModule.set(false);
    }
  }

  protected async assignReseller(resellerId: string | null): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.assignReseller(this.id(), resellerId));
      this.detail.set(await firstValueFrom(this.api.detail(this.id())));
      this.pickingReseller.set(false);
      this.notify.success(this.translate.instant('orgReseller.saved') as string);
    } catch (error) {
      const code = errorCodeOf(error);
      const known = code === 'NO_ES_RESELLER' || code === 'RESELLER_PROPIO';
      this.notify.error(this.translate.instant(known ? `orgReseller.error.${code}` : 'orgReseller.error.generic') as string);
    } finally {
      this.saving.set(false);
    }
  }

  private async applyState(request: Observable<PlatformOrgDetail>, doneKey: string): Promise<void> {
    this.switching.set(true);
    try {
      this.detail.set(await firstValueFrom(request));
      this.notify.success(this.translate.instant(doneKey) as string);
    } catch {
      this.notify.error(this.translate.instant('orgState.error') as string);
    } finally {
      this.switching.set(false);
    }
  }

  protected async refresh(): Promise<void> {
    try {
      this.detail.set(await firstValueFrom(this.api.detail(this.id())));
    } catch {
      return;
    }
  }

  protected reload(): void {
    void this.load(this.id());
  }

  protected async save(changes: PlatformOrgUpdate): Promise<void> {
    this.saving.set(true);
    try {
      this.detail.set(await firstValueFrom(this.api.update(this.id(), changes)));
      this.editing.set(false);
      this.notify.success(this.translate.instant('orgEdit.saved') as string);
    } catch (error) {
      const code = errorCodeOf(error);
      const known = code && ORG_EDIT_ERRORS.includes(code);
      this.notify.error(this.translate.instant(known ? `orgEdit.error.${code}` : 'orgEdit.error.generic') as string);
    } finally {
      this.saving.set(false);
    }
  }

  private async load(id: string): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const detail = await firstValueFrom(this.api.detail(id));
      if (current()) this.detail.set(detail);
    } catch {
      if (!current()) return;
      this.error.set(true);
      this.detail.set(null);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  private day(value?: string | null): string {
    return value ? formatDate(value, 'd/MM/y', this.locale) : '';
  }
}

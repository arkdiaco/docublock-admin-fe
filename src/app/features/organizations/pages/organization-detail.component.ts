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
import { firstValueFrom } from 'rxjs';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ModuleToggleComponent } from '../../../shared/ui/module-toggle.component';
import { QuotaBarComponent } from '../../../shared/ui/quota-bar.component';
import { RecordHeaderComponent } from '../../../shared/ui/record-header.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { UnderlineTabsComponent, type UnderlineTab } from '../../../shared/ui/underline-tabs.component';
import { OrganizationsApi } from '../data/organizations.api';
import type { PlatformOrgDetail } from '../data/organizations.models';
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
          [crumbs]="['nav.crumbRoot', 'nav.group.clients', 'nav.organizations', org.businessName]"
          [initials]="initials()"
          [title]="org.businessName"
          [state]="stateFamily()"
          [stateLabelKey]="stateLabel()"
          [meta]="meta()"
        >
          <div actions class="od__flags">
            @if (org.isReseller) {
              <span class="od__flag">{{ 'orgd.reseller' | translate }}</span>
            }
            @if (org.isTest) {
              <span class="od__flag od__flag--test">{{ 'orgd.test' | translate }}</span>
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
                  <dt>{{ 'orgd.f.email' | translate }}</dt>
                  <dd>{{ org.email || '—' }}</dd>
                  <dt>{{ 'orgd.f.phone' | translate }}</dt>
                  <dd>{{ org.phone || '—' }}</dd>
                  <dt>{{ 'orgd.f.address' | translate }}</dt>
                  <dd>{{ org.address || '—' }}</dd>
                  <dt>{{ 'orgd.f.web' | translate }}</dt>
                  <dd>{{ org.webSite || '—' }}</dd>
                  <dt>{{ 'orgd.f.created' | translate }}</dt>
                  <dd class="dba-mono">{{ created() }}</dd>
                </dl>
              </section>

              <section class="od__card">
                <h2 class="dba-panel">{{ 'orgd.modules' | translate }}</h2>
                <div class="od__modules">
                  @for (mod of modules; track mod.code) {
                    <dba-module-toggle [abbr]="mod.abbr" [name]="mod.labelKey | translate" [on]="has(org, mod.code)" disabled />
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
        } @else {
          <div class="od__panel">
            <dba-empty-state titleKey="orgd.soonTitle" leadKey="orgd.soonLead" />
          </div>
        }
      </div>
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
    }

    .od__flag {
      display: inline-flex;
      align-items: center;
      height: var(--dba-height-tag);
      padding: 0 10px;
      border: 1px solid var(--dba-border-control);
      border-radius: var(--dba-radius-pill);
      font-size: var(--dba-text-small);
      font-weight: 600;
      color: var(--dba-text-soft);
    }

    .od__flag--test {
      border-color: var(--dba-state-warning-border);
      background: var(--dba-state-warning-bg);
      color: var(--dba-state-warning-fg);
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

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.load(id);
    });
  }

  protected has(org: PlatformOrgDetail, code: string): boolean {
    return org.modules.includes(code);
  }


  protected reload(): void {
    void this.load(this.id());
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      this.detail.set(await firstValueFrom(this.api.detail(id)));
    } catch {
      this.error.set(true);
      this.detail.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  private day(value?: string | null): string {
    return value ? formatDate(value, 'd/MM/y', this.locale) : '';
  }
}

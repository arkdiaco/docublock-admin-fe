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
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { sectionPath } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { initialsOf } from '../../../shared/domain/initials';
import { errorStatusOf } from '../../../shared/http/error-code';
import { LatestRequest } from '../../../shared/http/latest-request';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { RecordHeaderComponent } from '../../../shared/ui/record-header.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { UsersApi } from '../data/users.api';
import type { PlatformUserDetail } from '../data/users.models';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

const COLUMNS: readonly DataColumn[] = [
  { key: 'organization', labelKey: 'usr.detail.col.organization', width: 'minmax(0, 1.5fr)' },
  { key: 'role', labelKey: 'usr.detail.col.role', width: 'minmax(0, 0.9fr)' },
  { key: 'contact', labelKey: 'usr.detail.col.contact', width: 'minmax(0, 1.1fr)' },
  { key: 'state', labelKey: 'usr.detail.col.state', width: '110px' },
  { key: 'chevron', width: '24px', align: 'end' },
];

@Component({
  selector: 'dba-user-detail',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    DataTableComponent,
    EmptyStateComponent,
    IconComponent,
    OrgStateComponent,
    RecordHeaderComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <db-section-loader [label]="'usr.detail.loading' | translate" />
    } @else if (missing()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="usr.detail.missingTitle" leadKey="usr.detail.missingLead" />
        <a dba-button variant="secondary" [routerLink]="[path]">{{
          'usr.detail.back' | translate
        }}</a>
      </div>
    } @else if (error()) {
      <div class="bd__panel">
        <dba-empty-state titleKey="usr.detail.errorTitle" leadKey="usr.detail.errorLead" />
        <button dba-button variant="secondary" (click)="reload()">
          {{ 'common.retry' | translate }}
        </button>
      </div>
    } @else if (user(); as item) {
      <div class="bd">
        <dba-record-header
          [initials]="initials()"
          [title]="fullName()"
          [state]="item.active ? 'active' : 'suspended'"
          [stateLabelKey]="item.active ? 'usr.state.active' : 'usr.state.inactive'"
          [meta]="item.identification"
        />

        <section class="bd__card">
          <h2 class="dba-panel">{{ 'usr.detail.section' | translate }}</h2>
          <dl class="bd__dl">
            <dt>{{ 'usr.detail.email' | translate }}</dt>
            <dd>{{ item.email || '—' }}</dd>
            <dt>{{ 'usr.detail.phone' | translate }}</dt>
            <dd class="dba-mono">{{ item.phone || '—' }}</dd>
            <dt>{{ 'usr.detail.document' | translate }}</dt>
            <dd class="dba-mono">
              {{ item.identificationType ? item.identificationType + ' · ' : ''
              }}{{ item.identification }}
            </dd>
            <dt>{{ 'usr.detail.country' | translate }}</dt>
            <dd>{{ item.countryName || '—' }}</dd>
            <dt>{{ 'usr.detail.city' | translate }}</dt>
            <dd>{{ item.cityName || '—' }}</dd>
            <dt>{{ 'usr.detail.expedition' | translate }}</dt>
            <dd>{{ expedition(item) }}</dd>
            <dt>{{ 'usr.detail.terms' | translate }}</dt>
            <dd>
              {{ (item.termsAccepted ? 'usr.detail.termsYes' : 'usr.detail.termsNo') | translate }}
            </dd>
            <dt>{{ 'usr.detail.created' | translate }}</dt>
            <dd class="dba-mono">{{ day(item.createdAt) }}</dd>
            <dt>{{ 'usr.detail.updated' | translate }}</dt>
            <dd class="dba-mono">{{ day(item.updatedAt) }}</dd>
          </dl>
        </section>

        <h2 class="dba-panel bd__heading">
          {{ 'usr.detail.organizations' | translate: { count: item.memberships.length } }}
        </h2>
        @if (item.memberships.length === 0) {
          <div class="bd__panel">
            <dba-empty-state titleKey="usr.detail.noOrgsTitle" leadKey="usr.detail.noOrgsLead" />
          </div>
        } @else {
          <dba-data-table
            [columns]="columns"
            [label]="'usr.detail.organizationsLabel' | translate"
            [dense]="density.compact()"
            minWidth="760px"
          >
            @for (row of item.memberships; track row.organizationId) {
              <a class="dba-tr bl-row" [routerLink]="[orgsPath, row.organizationId]">
                <span class="dba-td cell">
                  <span class="cell__label">{{
                    row.organizationName || ('usr.detail.orgMissing' | translate)
                  }}</span>
                  <span class="cell__meta">
                    <span class="dba-mono">{{ row.tributaryNumber || '—' }}</span>
                    @if (row.personal) {
                      · {{ 'usr.detail.personal' | translate }}
                    }
                  </span>
                </span>
                <span class="dba-td cell">
                  <span class="cell__text">{{
                    row.roleName || ('usr.detail.roleMissing' | translate)
                  }}</span>
                  @if (row.branchType) {
                    <span class="cell__meta">{{
                      'usr.detail.branch.' + row.branchType | translate
                    }}</span>
                  }
                </span>
                <span class="dba-td cell">
                  <span class="cell__text">{{ row.email || '—' }}</span>
                  <span class="cell__meta dba-mono">{{ row.phone || '—' }}</span>
                </span>
                <span class="dba-td">
                  <dba-org-state
                    [state]="row.active ? 'active' : 'suspended'"
                    [labelKey]="row.active ? 'usr.state.active' : 'usr.state.inactive'"
                    variant="inline"
                  />
                </span>
                <db-icon class="dba-td dba-td--end" name="chevronRight" [size]="15" />
              </a>
            }
          </dba-data-table>
        }
      </div>
    }
  `,
  styleUrls: ['../../../shared/ui/detail-page.scss', '../../../shared/ui/list-page.scss'],
})
export class UserDetailComponent {
  readonly id = input.required<string>();

  private readonly api = inject(UsersApi);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  protected readonly density = inject(DensityService);
  protected readonly columns = COLUMNS;
  protected readonly path = sectionPath('users');
  protected readonly orgsPath = sectionPath('organizations');
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly missing = signal(false);
  protected readonly user = signal<PlatformUserDetail | null>(null);
  protected readonly fullName = computed(() => {
    const user = this.user();
    return user ? `${user.names} ${user.surNames}`.trim() : '';
  });
  protected readonly initials = computed(() => initialsOf(this.fullName()));

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.load(id);
    });
  }

  protected reload(): void {
    void this.load(this.id());
  }

  protected day(value?: string): string {
    return value ? formatDate(value, 'd/MM/y', this.locale) : '—';
  }

  protected expedition(user: PlatformUserDetail): string {
    const date = user.expeditionDate;
    const shown = date && ISO_DAY.test(date) ? this.day(date) : date;
    return [user.expeditionCityName, shown].filter(Boolean).join(' · ') || '—';
  }

  private async load(id: string): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    this.missing.set(false);
    try {
      const user = await firstValueFrom(this.api.get(id));
      if (!current()) return;
      this.user.set(user);
    } catch (error) {
      if (!current()) return;
      const status = errorStatusOf(error);
      if (status === 404 || status === 400) this.missing.set(true);
      else this.error.set(true);
    }
    this.loading.set(false);
  }
}

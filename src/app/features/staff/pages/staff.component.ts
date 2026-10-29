import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';
import { firstValueFrom, type Observable } from 'rxjs';
import { MY_ACCESS_PATH } from '../../../core/layout/console-nav';
import { DensityService } from '../../../core/preferences/density.service';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { DataTableComponent, type DataColumn } from '../../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { FilterPillsComponent, type FilterPill } from '../../../shared/ui/filter-pills.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';
import { RoleTagComponent } from '../../../shared/ui/role-tag.component';
import { SectionLoaderComponent } from '../../../shared/ui/section-loader.component';
import { StaffFormComponent, type StaffFormResult } from '../components/staff-form.component';
import { staffErrorKey } from '../data/staff-error';
import { StaffApi } from '../data/staff.api';
import type { StaffMember, StaffStatus } from '../data/staff.models';

const COLUMNS: readonly DataColumn[] = [
  { key: 'person', labelKey: 'staff.col.person', width: 'minmax(240px, 2fr)' },
  { key: 'role', labelKey: 'staff.col.role', width: '130px' },
  { key: 'state', labelKey: 'staff.col.state', width: '130px' },
  { key: 'lastLogin', labelKey: 'staff.col.lastLogin', width: '150px' },
  { key: 'sessions', labelKey: 'staff.col.sessions', width: '90px', align: 'end' },
  { key: 'actions', width: '52px', align: 'end' },
];

type Filter = 'all' | StaffStatus;

interface RowView extends StaffMember {
  initials: string;
  lastLogin: string;
}

const initialsOf = (member: StaffMember): string =>
  ((member.names[0] ?? '') + (member.surNames[0] ?? '')).toUpperCase() ||
  member.email.slice(0, 2).toUpperCase();

@Component({
  selector: 'dba-staff',
  imports: [
    TranslatePipe,
    RouterLink,
    Menu,
    ButtonComponent,
    IconComponent,
    DataTableComponent,
    FilterPillsComponent,
    OrgStateComponent,
    RoleTagComponent,
    EmptyStateComponent,
    SectionLoaderComponent,
    StaffFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="staff">
      <header class="staff__head">
        <div class="staff__title">
          <h1 class="dba-page">{{ 'nav.staff' | translate }}</h1>
          <span class="dba-meta">{{
            'staff.count' | translate: { total: members().length, superadmins: superadmins() }
          }}</span>
        </div>
        <div class="staff__actions">
          <a dba-button variant="secondary" [routerLink]="myAccessPath">
            <db-icon name="user" [size]="15" />
            {{ 'mine.title' | translate }}
          </a>
          <button dba-button (click)="openGrant()">
            <db-icon name="plus" [size]="15" />
            {{ 'staff.grant' | translate }}
          </button>
        </div>
      </header>

      <db-filter-pills [pills]="pills()" [active]="filter()" (activeChange)="pickFilter($event)" />

      @if (loading()) {
        <db-section-loader [label]="'staff.loading' | translate" />
      } @else if (error()) {
        <div class="staff__panel">
          <dba-empty-state titleKey="staff.errorTitle" leadKey="staff.errorLead" />
          <button dba-button variant="secondary" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (rows().length === 0) {
        <div class="staff__panel">
          <dba-empty-state titleKey="staff.emptyTitle" leadKey="staff.emptyLead" />
        </div>
      } @else {
        <dba-data-table
          [columns]="columns"
          [label]="'nav.staff' | translate"
          [dense]="density.compact()"
          minWidth="760px"
        >
          @for (row of rows(); track row.id) {
            <div class="dba-tr">
              <div class="dba-td person">
                <span class="person__avatar" aria-hidden="true">{{ row.initials }}</span>
                <span class="person__text">
                  <span class="person__name">
                    {{ row.names }} {{ row.surNames }}
                    @if (row.isSelf) {
                      <span class="person__self">{{ 'staff.you' | translate }}</span>
                    }
                  </span>
                  <span class="person__mail">{{ row.email }}</span>
                </span>
              </div>
              <span class="dba-td"><dba-role-tag [role]="row.role" /></span>
              <span class="dba-td">
                <dba-org-state
                  [state]="row.status === 'ACTIVE' ? 'active' : 'suspended'"
                  [labelKey]="'staff.status.' + row.status"
                  variant="inline"
                />
              </span>
              <span class="dba-td dba-mono staff__when">{{
                row.lastLogin || ('staff.never' | translate)
              }}</span>
              <code class="dba-td dba-td--end staff__sessions">{{ row.activeSessions }}</code>
              <span class="dba-td dba-td--end">
                @if (!row.isSelf) {
                  <button
                    type="button"
                    class="staff__more"
                    [attr.aria-label]="'staff.actionsFor' | translate: { name: row.names }"
                    (click)="openActions($event, row)"
                  >
                    <db-icon name="moreVertical" [size]="16" />
                  </button>
                }
              </span>
            </div>
          }
        </dba-data-table>
      }
    </section>

    <p-menu
      #actions
      [model]="actionItems()"
      [popup]="true"
      appendTo="body"
      styleClass="dba-account-menu"
    />

    @if (form(); as open) {
      <dba-staff-form
        [member]="open.member"
        [busy]="saving()"
        (submitted)="save($event)"
        (dismissed)="form.set(null)"
      />
    }
  `,
  styles: `
    .staff {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .staff__head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
    }

    .staff__title {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .staff__actions {
      display: flex;
      gap: 10px;
    }

    .staff__panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .person {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .person__avatar {
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

    .person__text {
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .person__name {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--dba-text-cell);
      font-weight: 500;
      color: var(--dba-ink);
      white-space: nowrap;
    }

    .person__self {
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-eyebrow);
      font-weight: 600;
      color: var(--dba-violet-700);
    }

    .person__mail {
      overflow: hidden;
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-meta);
      color: var(--dba-text-muted);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .staff__when,
    .staff__sessions {
      font-size: var(--dba-text-small);
      color: var(--dba-text);
    }

    .staff__sessions {
      font-family: var(--dba-font-mono);
    }

    .staff__more {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: var(--dba-radius-control);
      background: transparent;
      color: var(--dba-text-muted);
      cursor: pointer;
    }

    .staff__more:hover {
      background: var(--dba-surface-hover);
      color: var(--dba-ink);
    }

    .staff__more:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px var(--dba-focus-halo);
    }

    @media (max-width: 640px) {
      .staff__head {
        flex-direction: column;
        align-items: stretch;
      }

      .staff__actions {
        flex-direction: column;
      }
    }
  `,
})
export class StaffComponent {
  private readonly api = inject(StaffApi);
  private readonly dialogs = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  protected readonly density = inject(DensityService);

  private readonly actionsMenu = viewChild<Menu>('actions');

  protected readonly columns = COLUMNS;
  protected readonly myAccessPath = '/' + MY_ACCESS_PATH;
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly saving = signal(false);
  protected readonly members = signal<StaffMember[]>([]);
  protected readonly filter = signal<Filter>('all');
  protected readonly form = signal<{ member: StaffMember | null } | null>(null);
  private readonly acting = signal<StaffMember | null>(null);

  protected readonly superadmins = computed(
    () => this.members().filter((m) => m.role === 'superadmin' && m.status === 'ACTIVE').length,
  );

  protected readonly pills = computed<FilterPill[]>(() => {
    const all = this.members();
    return [
      { key: 'all', labelKey: 'staff.filterAll', count: all.length },
      {
        key: 'ACTIVE',
        labelKey: 'staff.status.ACTIVE',
        count: all.filter((m) => m.status === 'ACTIVE').length,
      },
      {
        key: 'SUSPENDED',
        labelKey: 'staff.status.SUSPENDED',
        count: all.filter((m) => m.status === 'SUSPENDED').length,
        danger: true,
      },
    ];
  });

  protected readonly rows = computed<RowView[]>(() =>
    this.members()
      .filter((m) => this.filter() === 'all' || m.status === this.filter())
      .map((m) => ({
        ...m,
        initials: initialsOf(m),
        lastLogin: m.lastLoginAt ? formatDate(m.lastLoginAt, 'd/MM/y, HH:mm', this.locale) : '',
      })),
  );

  protected readonly actionItems = computed<MenuItem[]>(() => {
    const member = this.acting();
    if (!member) return [];
    const t = (key: string) => this.translate.instant(key) as string;
    const suspended = member.status === 'SUSPENDED';
    return [
      {
        label: t('staff.action.role'),
        icon: 'pi pi-id-card',
        command: () => this.form.set({ member }),
      },
      suspended
        ? {
            label: t('staff.action.reactivate'),
            icon: 'pi pi-play',
            command: () => void this.reactivate(member),
          }
        : {
            label: t('staff.action.suspend'),
            icon: 'pi pi-pause',
            command: () => void this.suspend(member),
          },
      { separator: true },
      {
        label: t('staff.action.remove'),
        icon: 'pi pi-user-minus',
        command: () => void this.remove(member),
      },
    ];
  });

  constructor() {
    void this.reload();
  }

  protected pickFilter(key: string): void {
    this.filter.set(key as Filter);
  }

  protected openGrant(): void {
    this.form.set({ member: null });
  }

  protected openActions(event: Event, member: StaffMember): void {
    this.acting.set(member);
    this.actionsMenu()?.toggle(event);
  }

  protected async reload(): Promise<void> {
    this.loading.set(this.members().length === 0);
    this.error.set(false);
    try {
      const { items } = await firstValueFrom(this.api.list());
      this.members.set(items);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected async save(result: StaffFormResult): Promise<void> {
    const member = this.form()?.member;
    this.saving.set(true);
    try {
      if (result.mode === 'grant') {
        const created = await firstValueFrom(this.api.grant(result.data));
        this.notify.success(
          this.translate.instant('staff.done.grant', { email: created.email }) as string,
        );
      } else if (member) {
        const updated = await firstValueFrom(this.api.change(member.id, { role: result.role }));
        this.notify.success(
          this.translate.instant('staff.done.role', { name: updated.names }) as string,
        );
      }
      this.form.set(null);
      await this.reload();
    } catch (error) {
      this.notify.error(this.translate.instant(staffErrorKey(error)) as string);
    } finally {
      this.saving.set(false);
    }
  }

  private async suspend(member: StaffMember): Promise<void> {
    const answer = await this.dialogs.open({
      intent: 'danger',
      icon: 'lock',
      title: 'staff.suspend.title',
      message: 'staff.suspend.message',
      params: { name: `${member.names} ${member.surNames}` },
      confirmLabel: 'staff.suspend.confirm',
      reason: {
        labelKey: 'staff.reasonLabel',
        placeholder: 'staff.reasonPlaceholder',
        limit: 500,
        quick: [],
        required: true,
      },
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    await this.apply(
      this.api.change(member.id, { status: 'SUSPENDED', reason: answer.reason }),
      'staff.done.suspend',
      member,
    );
  }

  private async reactivate(member: StaffMember): Promise<void> {
    const ok = await this.dialogs.confirm({
      intent: 'primary',
      icon: 'circleCheck',
      title: 'staff.reactivate.title',
      message: 'staff.reactivate.message',
      params: { name: `${member.names} ${member.surNames}` },
      confirmLabel: 'staff.reactivate.confirm',
    });
    if (!ok) return;
    await this.apply(
      this.api.change(member.id, { status: 'ACTIVE' }),
      'staff.done.reactivate',
      member,
    );
  }

  private async remove(member: StaffMember): Promise<void> {
    const answer = await this.dialogs.open({
      intent: 'danger',
      icon: 'trash',
      title: 'staff.remove.title',
      message: 'staff.remove.message',
      params: { name: `${member.names} ${member.surNames}` },
      confirmLabel: 'staff.remove.confirm',
      reason: {
        labelKey: 'staff.reasonLabel',
        placeholder: 'staff.reasonPlaceholder',
        limit: 500,
        quick: [],
        required: true,
      },
      challenge: { identifier: member.email, actionKey: 'staff.remove.verb' },
    });
    if (answer.answer !== 'confirm' || !answer.reason) return;
    await this.apply(this.api.remove(member.id, answer.reason), 'staff.done.remove', member);
  }

  private async apply(
    request: Observable<unknown>,
    doneKey: string,
    member: StaffMember,
  ): Promise<void> {
    try {
      await firstValueFrom(request);
      this.notify.success(this.translate.instant(doneKey, { name: member.names }) as string);
      await this.reload();
    } catch (error) {
      this.notify.error(this.translate.instant(staffErrorKey(error)) as string);
    }
  }
}

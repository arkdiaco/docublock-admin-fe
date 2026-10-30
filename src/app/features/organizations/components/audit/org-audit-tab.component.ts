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
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { sectionPath } from '../../../../core/layout/console-nav';
import {
  AUDIT_FILTER_PARAM,
  emailHandle,
  organizationAuditFilter,
} from '../../../../shared/domain/audit-link';
import { LatestRequest } from '../../../../shared/http/latest-request';
import { AuditEventComponent } from '../../../../shared/ui/audit-event.component';
import { ButtonComponent } from '../../../../shared/ui/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state.component';
import { SectionLoaderComponent } from '../../../../shared/ui/section-loader.component';
import { OrgAuditApi } from '../../data/org-audit.api';
import type { OrgAuditEvent } from '../../data/org-audit.models';
import type { PlatformOrgDetail } from '../../data/organizations.models';

const LIMIT = 20;

@Component({
  selector: 'dba-org-audit-tab',
  imports: [
    TranslatePipe,
    RouterLink,
    AuditEventComponent,
    ButtonComponent,
    EmptyStateComponent,
    SectionLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="oa">
      <header class="oa__head">
        <div class="oa__title">
          <h2 class="dba-panel">{{ 'orgAudit.title' | translate }}</h2>
          @if (!loading() && !error()) {
            <span class="dba-meta">{{
              'orgAudit.count' | translate: { shown: items().length, total: total() }
            }}</span>
          }
        </div>
        <a class="oa__link" [routerLink]="auditPath" [queryParams]="auditQuery()">
          {{ 'orgAudit.openAll' | translate }}
        </a>
      </header>

      @if (loading()) {
        <db-section-loader [label]="'orgAudit.loading' | translate" />
      } @else if (error()) {
        <div class="oa__state">
          <dba-empty-state titleKey="orgAudit.errorTitle" />
          <button dba-button variant="secondary" (click)="reload()">
            {{ 'common.retry' | translate }}
          </button>
        </div>
      } @else if (items().length === 0) {
        <dba-empty-state titleKey="orgAudit.emptyTitle" leadKey="orgAudit.emptyLead" />
      } @else {
        <div class="oa__events">
          @for (row of items(); track row.id; let last = $last) {
            <dba-audit-event
              [actor]="actorOf(row)"
              [meta]="metaOf(row)"
              [last]="last && !hasMore()"
            >
              <span class="oa__what">
                <code class="dba-ref">{{ row.action }}</code>
                @if (row.reason) {
                  <span class="oa__reason">«{{ row.reason }}»</span>
                }
              </span>
            </dba-audit-event>
          }
        </div>
        @if (hasMore()) {
          <button
            dba-button
            variant="secondary"
            class="oa__more"
            [busy]="loadingMore()"
            (click)="more()"
          >
            {{ 'orgAudit.more' | translate }}
          </button>
        }
      }
    </section>
  `,
  styles: `
    .oa {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 18px 20px;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .oa__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .oa__title {
      display: flex;
      align-items: baseline;
      gap: 10px;
      flex-wrap: wrap;
    }

    .oa__link {
      font-weight: 600;
      color: var(--dba-violet-600);
      text-decoration: none;
    }

    .oa__link:hover {
      text-decoration: underline;
    }

    .oa__link:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .oa__events {
      display: flex;
      flex-direction: column;
    }

    .oa__what {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4px 8px;
      margin-left: 8px;
    }

    .oa__reason {
      color: var(--dba-text-muted);
      overflow-wrap: anywhere;
    }

    .oa__state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .oa__more {
      align-self: flex-start;
    }
  `,
})
export class OrgAuditTabComponent {
  private readonly api = inject(OrgAuditApi);
  private readonly locale = inject(LOCALE_ID);
  private readonly latest = new LatestRequest();

  readonly org = input.required<PlatformOrgDetail>();

  protected readonly auditPath = sectionPath('audit');
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly error = signal(false);
  protected readonly items = signal<OrgAuditEvent[]>([]);
  protected readonly total = signal(0);
  private readonly page = signal(1);
  private readonly orgId = computed(() => this.org().id);

  protected readonly hasMore = computed(() => this.items().length < this.total());
  protected readonly auditQuery = computed(() => ({
    [AUDIT_FILTER_PARAM]: organizationAuditFilter(this.orgId()),
  }));

  constructor() {
    effect(() => {
      const id = this.orgId();
      untracked(() => void this.load(id));
    });
  }

  protected reload(): void {
    void this.load(this.orgId());
  }

  protected async more(): Promise<void> {
    this.loadingMore.set(true);
    try {
      const next = this.page() + 1;
      const page = await firstValueFrom(this.api.list(this.orgId(), next, LIMIT));
      this.items.update((current) => [...current, ...page.items]);
      this.total.set(page.total);
      this.page.set(next);
    } catch {
      return;
    } finally {
      this.loadingMore.set(false);
    }
  }

  protected actorOf(row: OrgAuditEvent): string {
    return row.admin.name || emailHandle(row.admin.email) || row.admin.id;
  }

  protected metaOf(row: OrgAuditEvent): string {
    return row.createdAt
      ? `${formatDate(row.createdAt, 'd/MM/y HH:mm', this.locale, 'UTC')} UTC`
      : '';
  }

  private async load(id: string): Promise<void> {
    const current = this.latest.start();
    this.loading.set(true);
    this.error.set(false);
    try {
      const page = await firstValueFrom(this.api.list(id, 1, LIMIT));
      if (!current()) return;
      this.items.set(page.items);
      this.total.set(page.total);
      this.page.set(1);
    } catch {
      if (current()) this.error.set(true);
    } finally {
      if (current()) this.loading.set(false);
    }
  }
}

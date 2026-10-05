import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { KpiCardComponent } from '../../../shared/ui/kpi-card.component';

const KPI_KEYS = ['overview.kpiOrgs', 'overview.kpiUsers', 'overview.kpiSigns', 'overview.kpiWarn'] as const;

export const greetingKeyOf = (hour: number): string => {
  if (hour < 12) return 'overview.greeting.morning';
  if (hour < 19) return 'overview.greeting.afternoon';
  return 'overview.greeting.evening';
};

@Component({
  selector: 'dba-overview',
  imports: [TranslatePipe, RouterLink, KpiCardComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ov">
      <header class="ov__head">
        <span class="dba-meta ov__date">{{ today }}</span>
        <h1 class="dba-page">{{ greetingKey | translate: { name: firstName() } }}</h1>
      </header>

      <div class="ov__kpis">
        @for (key of kpis; track key) {
          <dba-kpi-card [label]="key" value="—" [delta]="'overview.noData' | translate" />
        }
      </div>

      <div class="ov__panels">
        <section class="panel">
          <header class="panel__head">
            <span class="dba-panel">{{ 'overview.actions' | translate }}</span>
            <code class="dba-meta">0</code>
          </header>
          <dba-empty-state titleKey="overview.actionsEmpty" leadKey="overview.actionsLead" />
        </section>

        <section class="panel">
          <header class="panel__head">
            <span class="dba-panel">{{ 'overview.activity' | translate }}</span>
            <a class="panel__link" routerLink="/auditoria">{{ 'nav.audit' | translate }}</a>
          </header>
          <dba-empty-state titleKey="overview.activityEmpty" leadKey="overview.activityLead" />
        </section>
      </div>
    </section>
  `,
  styles: `
    .ov {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .ov__head {
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

    .ov__panels {
      display: grid;
      grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
      gap: var(--dba-grid-gap);
    }

    .panel {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
      overflow: hidden;
    }

    .panel__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      border-bottom: 1px solid var(--dba-border-card);
    }

    .panel__link {
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-violet-700);
      text-decoration: none;
    }

    @media (max-width: 1100px) {
      .ov__kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 760px) {
      .ov__kpis,
      .ov__panels {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class OverviewComponent {
  private readonly auth = inject(AuthStore);
  private readonly locale = inject(LOCALE_ID);

  protected readonly kpis = KPI_KEYS;
  protected readonly today = formatDate(new Date(), 'fullDate', this.locale);
  protected readonly greetingKey = greetingKeyOf(new Date().getHours());
  protected readonly firstName = computed(() => (this.auth.user()?.names ?? '').trim().split(/\s+/)[0] ?? '');
}

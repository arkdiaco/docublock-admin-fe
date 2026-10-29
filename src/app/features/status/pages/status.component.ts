import { HttpClient, HttpContext } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, map, of } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { API_BASE_URL, APP_ENV } from '../../../core/config/api.tokens';
import { envLabelKey } from '../../../shared/domain/environment';
import { SILENT_ERRORS, SKIP_AUTH } from '../../../core/http/http.interceptors';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { OrgStateComponent } from '../../../shared/ui/org-state.component';

type Check = 'checking' | 'ok' | 'fail';

const CHECK_STATE: Record<Check, string> = { checking: 'trial', ok: 'active', fail: 'suspended' };

@Component({
  selector: 'dba-status',
  imports: [TranslatePipe, ButtonComponent, OrgStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="status">
      <header class="status__head">
        <h1 class="dba-page">{{ 'nav.health' | translate }}</h1>
        <p class="dba-body status__lead">{{ 'status.lead' | translate }}</p>
      </header>

      <dl class="status__grid">
        <dt class="dba-th">{{ 'status.env' | translate }}</dt>
        <dd class="dba-mono">{{ envLabel | translate }}</dd>

        <dt class="dba-th">{{ 'status.api' | translate }}</dt>
        <dd>
          <span class="dba-mono status__value">{{ apiBase }}</span>
          <span class="status__check">
            <dba-org-state [state]="checkState()" [labelKey]="checkKey()" />
            @if (detail(); as text) {
              <span class="dba-meta status__detail">· {{ text }}</span>
            }
          </span>
        </dd>

        <dt class="dba-th">{{ 'status.session' | translate }}</dt>
        <dd>{{ (auth.isAuthenticated() ? 'status.yes' : 'status.no') | translate }}</dd>

        <dt class="dba-th">{{ 'status.staff' | translate }}</dt>
        <dd>{{ (auth.platformStaff() ? 'status.yes' : 'status.no') | translate }}</dd>
      </dl>

      <div>
        <button dba-button variant="secondary" class="status__retry" [busy]="check() === 'checking'" (click)="probe()">
          {{ 'status.retry' | translate }}
        </button>
      </div>
    </section>
  `,
  styles: `
    .status {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .status__head {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .status__lead {
      margin: 0;
      color: var(--dba-text-muted);
    }

    .status__grid {
      display: grid;
      grid-template-columns: 196px 1fr;
      align-items: center;
      gap: 0;
      margin: 0;
      border: 1px solid var(--dba-border-card);
      border-radius: var(--dba-radius-panel);
      background: var(--dba-surface);
    }

    .status__grid dt,
    .status__grid dd {
      min-height: var(--dba-height-row);
      display: flex;
      align-items: center;
      padding: 0 18px;
      border-top: 1px solid var(--dba-border-row);
    }

    .status__grid dt:first-of-type,
    .status__grid dd:first-of-type {
      border-top: 0;
    }

    .status__grid dd {
      flex-wrap: wrap;
      gap: 10px;
      margin: 0;
      font-size: var(--dba-text-cell);
      color: var(--dba-ink);
    }

    .status__value {
      overflow-wrap: anywhere;
    }

    .status__check {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    @media (max-width: 720px) {
      .status__grid {
        grid-template-columns: 1fr;
      }

      .status__grid dt {
        min-height: 0;
        padding-top: 12px;
      }

      .status__grid dd {
        min-height: 0;
        padding-bottom: 12px;
        border-top: 0;
      }
    }
  `,
})
export class StatusComponent {
  private readonly http = inject(HttpClient);
  protected readonly auth = inject(AuthStore);
  protected readonly env = inject(APP_ENV);
  protected readonly envLabel = envLabelKey(this.env.name);
  protected readonly apiBase = inject(API_BASE_URL);
  protected readonly check = signal<Check>('checking');
  protected readonly detail = signal('');
  protected readonly checkKey = computed(() => `status.${this.check()}`);
  protected readonly checkState = computed(() => CHECK_STATE[this.check()]);

  constructor() {
    this.probe();
  }

  protected probe(): void {
    this.check.set('checking');
    this.detail.set('');
    this.http
      .get<{ status?: string }>('/health', {
        context: new HttpContext().set(SKIP_AUTH, true).set(SILENT_ERRORS, true),
      })
      .pipe(
        map((reply) => ({ ok: true, detail: reply?.status ?? '' })),
        catchError((error: { status?: number }) =>
          of({ ok: false, detail: error.status ? `HTTP ${error.status}` : '' }),
        ),
      )
      .subscribe(({ ok, detail }) => {
        this.check.set(ok ? 'ok' : 'fail');
        this.detail.set(detail);
      });
  }
}

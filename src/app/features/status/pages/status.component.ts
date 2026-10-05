import { HttpClient, HttpContext } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, finalize, map, of } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { API_BASE_URL, APP_ENV } from '../../../core/config/api.tokens';
import { envLabelKey } from '../../../shared/domain/environment';
import { SILENT_ERRORS, SKIP_AUTH } from '../../../core/http/http.interceptors';
import { LoaderComponent } from '../../../shared/ui/loader.component';

type Check = 'checking' | 'ok' | 'fail';

@Component({
  selector: 'dba-status',
  imports: [TranslatePipe, LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="status">
      <header class="status__head">
        <span class="dba-eyebrow">{{ 'nav.crumbRoot' | translate }}</span>
        <h1 class="dba-page">{{ 'status.title' | translate }}</h1>
        <p class="status__lead">{{ 'status.lead' | translate }}</p>
      </header>

      <dl class="status__grid">
        <dt>{{ 'status.env' | translate }}</dt>
        <dd class="db-mono">{{ envLabel | translate }}</dd>

        <dt>{{ 'status.api' | translate }}</dt>
        <dd>
          <span class="db-mono">{{ apiBase }}</span>
          <span class="status__pill" [class.status__pill--ok]="check() === 'ok'" [class.status__pill--fail]="check() === 'fail'">
            @if (check() === 'checking') {
              <db-loader size="14px" />
            }
            {{ checkKey() | translate }}
            @if (detail(); as text) {
              <span class="status__detail db-mono">· {{ text }}</span>
            }
          </span>
        </dd>

        <dt>{{ 'status.session' | translate }}</dt>
        <dd>{{ (auth.isAuthenticated() ? 'status.yes' : 'status.no') | translate }}</dd>

        <dt>{{ 'status.staff' | translate }}</dt>
        <dd>{{ (auth.platformStaff() ? 'status.yes' : 'status.no') | translate }}</dd>
      </dl>

      <button type="button" class="status__retry" [disabled]="check() === 'checking'" (click)="probe()">
        {{ 'status.retry' | translate }}
      </button>
    </section>
  `,
  styles: `
    .status {
      max-width: 720px;
      font-family: var(--db-font);
      color: var(--db-ink-strong);
    }

    .status__lead {
      margin: 0 0 24px;
      color: var(--db-ink-note-soft);
    }

    .status__grid {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 12px 16px;
      margin: 0 0 24px;
    }

    .status__grid dt {
      color: var(--db-ink-label);
      font-size: var(--db-text-counter);
    }

    .status__grid dd {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin: 0;
    }

    .status__pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px;
      border-radius: var(--db-radius-pill);
      background: var(--db-surface-chip);
      font-size: var(--db-text-counter);
      font-weight: 600;
    }

    .status__pill--ok {
      background: var(--db-success-wash);
      color: var(--db-success-ink);
    }

    .status__pill--fail {
      background: var(--db-danger-wash);
      color: var(--db-danger-ink);
    }

    .status__detail {
      font-weight: 400;
      color: var(--db-ink-note-soft);
    }

    .status__retry {
      padding: 9px 16px;
      border: 0;
      border-radius: var(--db-radius-field);
      background: var(--db-primary);
      font-family: var(--db-font);
      font-size: var(--db-text-body);
      font-weight: 600;
      color: var(--db-primary-contrast);
      cursor: pointer;
    }

    .status__retry:disabled {
      opacity: 0.6;
      cursor: progress;
    }

    @media (max-width: 720px) {
      .status {
        padding: 24px 16px;
      }

      .status__grid {
        grid-template-columns: 1fr;
        gap: 4px 0;
      }

      .status__grid dd {
        margin-bottom: 12px;
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
        finalize(() => undefined),
      )
      .subscribe(({ ok, detail }) => {
        this.check.set(ok ? 'ok' : 'fail');
        this.detail.set(detail);
      });
  }
}

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ORG_STATES } from '../../../shared/domain/org-state';
import { PLATFORM_ROLES } from '../../../shared/domain/platform-role';

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

@Component({
  selector: 'dba-design-system',
  imports: [TranslatePipe],
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
              <span class="pill pill--{{ state.key }}">
                <span class="pill__dot pill__dot--{{ state.shape }}"></span>
                {{ state.labelKey | translate }}
              </span>
              <span class="dba-body">{{ state.descKey | translate }}</span>
            </div>
          }
          <p class="dba-meta sys__note">{{ 'sys.statesNote' | translate }}</p>
        </div>
        <div class="sys__block">
          <h2 class="dba-eyebrow sys__eyebrow">{{ 'sys.roles' | translate }}</h2>
          @for (role of roles; track role.key) {
            <div class="row">
              <span class="role role--{{ role.key }}">{{ role.labelKey | translate }}</span>
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

    .sys__cols {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--dba-grid-gap);
    }

    .sys__eyebrow {
      margin: 0 0 8px;
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

    .sys__note {
      margin: 12px 0 0;
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

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      height: 26px;
      padding: 0 10px;
      border: 1px solid;
      border-radius: var(--dba-radius-pill);
      font-size: var(--dba-text-small);
      font-weight: 600;
      white-space: nowrap;
    }

    .pill--active { background: var(--dba-state-active-bg); border-color: var(--dba-state-active-border); color: var(--dba-state-active-fg); --dot: var(--dba-state-active-dot); }
    .pill--trial { background: var(--dba-state-trial-bg); border-color: var(--dba-state-trial-border); color: var(--dba-state-trial-fg); --dot: var(--dba-state-trial-dot); }
    .pill--warning { background: var(--dba-state-warning-bg); border-color: var(--dba-state-warning-border); color: var(--dba-state-warning-fg); --dot: var(--dba-state-warning-dot); }
    .pill--suspended { background: var(--dba-state-suspended-bg); border-color: var(--dba-state-suspended-border); color: var(--dba-state-suspended-fg); --dot: var(--dba-state-suspended-dot); }
    .pill--closed { background: var(--dba-state-closed-bg); border-color: var(--dba-state-closed-border); color: var(--dba-state-closed-fg); --dot: var(--dba-state-closed-dot); }

    .pill__dot {
      flex: none;
      width: 8px;
      height: 8px;
      background: var(--dot);
    }

    .pill__dot--circle { border-radius: 999px; }
    .pill__dot--ring { border-radius: 999px; background: transparent; border: 2px solid var(--dot); }
    .pill__dot--square { border-radius: 1px; }
    .pill__dot--dash { height: 2px; border-radius: 0; }

    .role {
      display: inline-flex;
      align-items: center;
      height: 22px;
      padding: 0 8px;
      border: 1px solid;
      border-radius: var(--dba-radius-key);
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-eyebrow);
      font-weight: 600;
      letter-spacing: var(--dba-tracking-tag);
      white-space: nowrap;
    }

    .role--superadmin { background: var(--dba-role-superadmin-bg); border-color: var(--dba-role-superadmin-border); color: var(--dba-role-superadmin-fg); }
    .role--support { background: var(--dba-role-support-bg); border-color: var(--dba-role-support-border); color: var(--dba-role-support-fg); }
    .role--orgAdmin { background: var(--dba-role-org-bg); border-color: var(--dba-role-org-border); color: var(--dba-role-org-fg); }
    .role--readonly { background: var(--dba-role-readonly-bg); border-color: var(--dba-role-readonly-border); color: var(--dba-role-readonly-fg); }

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
    }
  `,
})
export class DesignSystemComponent {
  protected readonly ramp = RAMP;
  protected readonly states = ORG_STATES;
  protected readonly roles = PLATFORM_ROLES;
  protected readonly samples = TYPE_SAMPLES;
}

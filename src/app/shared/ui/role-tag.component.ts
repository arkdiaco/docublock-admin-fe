import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { platformRoleOf } from '../domain/platform-role';

@Component({
  selector: 'dba-role-tag',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="role" [class]="'role role--' + view().key">{{ view().labelKey | translate }}</span>`,
  styles: `
    :host {
      display: inline-flex;
    }

    .role {
      display: inline-flex;
      align-items: center;
      height: var(--dba-height-tag);
      padding: 0 8px;
      border: 1px solid;
      border-radius: var(--dba-radius-tag);
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-eyebrow);
      font-weight: 600;
      letter-spacing: var(--dba-tracking-tag);
      white-space: nowrap;
    }

    .role--superadmin {
      background: var(--dba-role-superadmin-bg);
      border-color: var(--dba-role-superadmin-border);
      color: var(--dba-role-superadmin-fg);
    }

    .role--support {
      background: var(--dba-role-support-bg);
      border-color: var(--dba-role-support-border);
      color: var(--dba-role-support-fg);
    }

    .role--orgAdmin {
      background: var(--dba-role-org-bg);
      border-color: var(--dba-role-org-border);
      color: var(--dba-role-org-fg);
    }

    .role--readonly {
      background: var(--dba-role-readonly-bg);
      border-color: var(--dba-role-readonly-border);
      color: var(--dba-role-readonly-fg);
    }
  `,
})
export class RoleTagComponent {
  readonly role = input.required<string>();

  protected readonly view = computed(() => platformRoleOf(this.role()));
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

export type OrgFlagKind = 'reseller' | 'test';

@Component({
  selector: 'dba-org-flag',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="flag" [class]="'flag flag--' + kind()">{{
    'orgFlag.' + kind() | translate
  }}</span>`,
  styles: `
    :host {
      display: inline-flex;
    }

    .flag {
      display: inline-flex;
      align-items: center;
      height: var(--dba-height-tag);
      padding: 0 8px;
      border: 1px solid var(--dba-border-control);
      border-radius: var(--dba-radius-tag);
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-eyebrow);
      font-weight: 600;
      letter-spacing: var(--dba-tracking-tag);
      color: var(--dba-text-soft);
      white-space: nowrap;
    }

    .flag--test {
      border-color: var(--dba-state-warning-border);
      background: var(--dba-state-warning-bg);
      color: var(--dba-state-warning-fg);
    }
  `,
})
export class OrgFlagComponent {
  readonly kind = input.required<OrgFlagKind>();
}

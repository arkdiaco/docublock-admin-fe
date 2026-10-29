import { ChangeDetectionStrategy, Component, input, output, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Popover } from 'primeng/popover';

export interface ActionMenuItem {
  key: string;
  labelKey: string;
  danger?: boolean;
  separated?: boolean;
}

@Component({
  selector: 'dba-action-menu',
  imports: [TranslatePipe, Popover],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-popover #panel styleClass="dba-nav-pop" appendTo="body">
      @if (heading()) {
        <p class="heading">{{ heading() }}</p>
      }
      <ul class="list" role="menu" [attr.aria-label]="label() | translate">
        @for (item of items(); track item.key) {
          <li role="none" [class.sep]="item.separated">
            <button
              type="button"
              role="menuitem"
              class="item"
              [class.item--danger]="item.danger"
              (click)="pick(item.key)"
            >
              {{ item.labelKey | translate }}
            </button>
          </li>
        }
      </ul>
    </p-popover>
  `,
  styles: `
    :host {
      display: contents;
    }

    .heading {
      margin: 2px 10px 8px;
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-ink);
      white-space: nowrap;
    }

    .list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 200px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .sep {
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px solid var(--dba-border-row);
    }

    .item {
      display: flex;
      align-items: center;
      width: 100%;
      height: 36px;
      padding: 0 10px;
      border: 0;
      border-radius: var(--dba-radius-control);
      background: transparent;
      font-family: var(--dba-font-ui);
      font-size: var(--dba-text-cell);
      font-weight: 500;
      color: var(--dba-text);
      text-align: left;
      white-space: nowrap;
      cursor: pointer;
    }

    .item:hover {
      background: var(--dba-surface-hover);
      color: var(--dba-ink);
    }

    .item:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px var(--dba-focus-halo);
    }

    .item--danger,
    .item--danger:hover {
      color: var(--dba-state-suspended-fg);
    }
  `,
})
export class ActionMenuComponent {
  readonly items = input.required<readonly ActionMenuItem[]>();
  readonly label = input.required<string>();
  readonly heading = input('');
  readonly picked = output<string>();

  private readonly panel = viewChild.required<Popover>('panel');

  toggle(event: Event): void {
    this.panel().toggle(event, event.currentTarget as HTMLElement);
  }

  protected pick(key: string): void {
    this.panel().hide();
    this.picked.emit(key);
  }
}

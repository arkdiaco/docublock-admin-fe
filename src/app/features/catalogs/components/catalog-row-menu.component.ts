import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ActionMenuComponent, type ActionMenuItem } from '../../../shared/ui/action-menu.component';
import { IconComponent } from '../../../shared/ui/icon.component';

const EDIT_REMOVE: ActionMenuItem[] = [
  { key: 'edit', labelKey: 'cat.action.edit' },
  { key: 'remove', labelKey: 'cat.action.remove', danger: true, separated: true },
];

@Component({
  selector: 'dba-catalog-row-menu',
  imports: [TranslatePipe, ActionMenuComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="more"
      [disabled]="disabled()"
      [attr.aria-label]="'cat.action.actionsFor' | translate: { name: name() }"
      (click)="menu.toggle($event)"
    >
      <db-icon name="moreVertical" [size]="16" />
    </button>
    <dba-action-menu #menu label="cat.action.actions" [items]="items()" (picked)="onPick($event)" />
  `,
  styles: `
    .more {
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

    .more:hover {
      background: var(--dba-surface-hover);
      color: var(--dba-ink);
    }

    .more:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px var(--dba-focus-halo);
    }
  `,
})
export class CatalogRowMenuComponent {
  readonly name = input.required<string>();
  readonly disabled = input(false);
  readonly items = input<ActionMenuItem[]>(EDIT_REMOVE);
  readonly picked = output<string>();
  readonly edit = output<void>();
  readonly remove = output<void>();

  protected onPick(key: string): void {
    this.picked.emit(key);
    if (key === 'edit') this.edit.emit();
    if (key === 'remove') this.remove.emit();
  }
}

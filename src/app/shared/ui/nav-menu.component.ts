import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { MenuItem } from 'primeng/api';
import { IconComponent, type IconName } from './icon.component';
import { Menu } from 'primeng/menu';

export interface NavEntry {
  key: string;
  label: string;
  icon: IconName;
  count?: number;
  shortcut?: string;
  active?: boolean;
  route?: string;
}

export interface NavGroup {
  key: string;
  label?: string;
  total?: string;
  rail?: boolean;
  entries: NavEntry[];
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'db-nav-menu',
  imports: [Menu, IconComponent],
  template: `
    <p-menu [model]="items()" styleClass="navmenu">
      <ng-template #item let-entry>
        <span class="navmenu__item">
          <db-icon class="navmenu__icon" [name]="entry.icon" [size]="18" />
          <span class="navmenu__label">{{ entry.label }}</span>
          @if (entry.state.shortcut) {
            <span class="navmenu__shortcut">{{ entry.state.shortcut }}</span>
          } @else if (entry.state.count !== undefined) {
            <span class="navmenu__count">{{ entry.state.count }}</span>
          }
        </span>
      </ng-template>
    </p-menu>
  `,
  styles: `
    ::ng-deep .p-menu.navmenu {
      background: transparent;
      border: 0;
      box-shadow: none;
      width: 100%;
    }

    ::ng-deep .navmenu .p-menu-list {
      padding: 0;
      gap: 1px;
    }

    ::ng-deep .navmenu .p-menu-item-content {
      border-radius: var(--db-radius-control);
    }

    ::ng-deep .navmenu .p-menu-item-link {
      padding: 0;
      gap: 0;
    }

    .navmenu__item {
      display: flex;
      align-items: center;
      gap: 11px;
      width: 100%;
      padding: 8px 11px;
    }

    .navmenu__icon {
      flex: 0 0 auto;
      width: 18px;
      font-size: 15px;
      color: var(--db-ink-faint);
    }

    .navmenu__label {
      flex: 1;
      min-width: 0;
      font-size: var(--db-text-nav);
      font-weight: 500;
      letter-spacing: var(--db-tracking-title);
      color: var(--db-ink-muted);
      text-align: left;
    }

    .navmenu__count {
      flex: 0 0 auto;
      font-size: var(--db-text-small);
      font-weight: 500;
      color: var(--db-ink-faint);
      font-variant-numeric: tabular-nums;
    }

    .navmenu__shortcut {
      flex: 0 0 auto;
      font-size: var(--db-text-nano);
      font-weight: 500;
      color: var(--db-primary-soft);
    }

    ::ng-deep .navmenu .db-active .navmenu__label {
      font-weight: 600;
      color: var(--db-ink-strong);
    }

    ::ng-deep .navmenu .db-active .navmenu__icon {
      color: var(--db-primary-ink);
    }
  `,
})
export class NavMenuComponent {
  readonly entries = input<NavEntry[]>([]);
  readonly entryClick = output<string>();

  readonly items = computed<MenuItem[]>(() =>
    this.entries().map((entry) => ({
      label: entry.label,
      icon: entry.icon,
      routerLink: entry.route,
      styleClass: entry.active ? 'db-active' : undefined,
      state: {
        count: entry.count,
        shortcut: entry.shortcut,
      } as unknown as Record<string, unknown>,
      command: () => this.entryClick.emit(entry.key),
    })),
  );
}

import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';
import { filter, map } from 'rxjs';
import { EnvPillComponent } from '../../shared/ui/env-pill.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { LogoComponent } from '../../shared/ui/logo.component';
import { AuthStore } from '../auth/auth.store';
import { LOGIN_ROUTE, SessionService } from '../auth/session.service';
import { APP_ENV } from '../config/api.tokens';
import { DensityService } from '../preferences/density.service';
import { CONSOLE_ENTRIES, canSeeArea } from './console-nav';
import { titleKeysOf } from './console-title.strategy';
import { NavCounts } from './nav-counts.service';
import { SearchDialogComponent } from './search-dialog.component';

@Component({
  selector: 'dba-console-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, LogoComponent, EnvPillComponent, IconComponent, Menu, SearchDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    <a class="skip" href="#dba-main">{{ 'shell.skip' | translate }}</a>
    <header class="bar">
      <a class="bar__brand" routerLink="/panel" [attr.aria-label]="'shell.brand' | translate">
        <dba-logo />
        <span class="dba-tag bar__tag">{{ 'shell.product' | translate }}</span>
      </a>

      <nav class="bar__nav" [attr.aria-label]="'shell.menu' | translate">
        @for (entry of entries(); track entry.key) {
          <a
            class="bar__link"
            [routerLink]="'/' + entry.path"
            routerLinkActive="bar__link--on"
            #active="routerLinkActive"
            [attr.aria-current]="active.isActive ? 'page' : null"
          >
            <span class="bar__label">{{ entry.labelKey | translate }}</span>
            @if (counts()[entry.key]; as count) {
              <code class="bar__count">{{ count }}</code>
            }
          </a>
        }
      </nav>

      <div class="bar__tools">
        <button type="button" class="bar__search" (click)="openSearch()">
          <db-icon name="search" [size]="14" />
          <span class="bar__searchText">{{ 'shell.search' | translate }}</span>
          <kbd class="bar__kbd">⌘K</kbd>
        </button>
        <dba-env-pill [env]="env.name" />
        @if (auth.isAuthenticated()) {
          <button type="button" class="bar__avatar" [attr.aria-label]="'shell.account' | translate" (click)="accountMenu()?.toggle($event)">
            {{ auth.initials() || '·' }}
          </button>
          <p-menu #account [model]="accountItems()" [popup]="true" appendTo="body" styleClass="dba-account-menu" />
        } @else {
          <a class="bar__enter" [routerLink]="loginRoute">{{ 'shell.enter' | translate }}</a>
        }
      </div>
    </header>

    <nav class="crumbs" [attr.aria-label]="'shell.crumbs' | translate">
      <span class="crumbs__item">{{ 'nav.crumbRoot' | translate }}</span>
      @for (crumb of crumbs(); track $index) {
        <span class="crumbs__sep" aria-hidden="true">/</span>
        <span class="crumbs__item" [class.crumbs__item--last]="$last">{{ crumb | translate }}</span>
      }
    </nav>

    <main id="dba-main" class="main" tabindex="-1">
      <router-outlet />
    </main>

    @if (searchOpen()) {
      <dba-search-dialog (closed)="searchOpen.set(false)" />
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: var(--dba-canvas);
    }

    .skip {
      position: fixed;
      top: -60px;
      left: 12px;
      z-index: 40;
      padding: 10px 14px;
      border-radius: var(--dba-radius-control);
      background: var(--dba-violet-500);
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-surface);
      text-decoration: none;
      transition: top 0.15s;
    }

    .skip:focus {
      top: 12px;
      outline: none;
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .main:focus {
      outline: none;
    }

    .bar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      gap: 28px;
      height: var(--dba-height-bar);
      padding: 0 24px;
      border-bottom: 1px solid var(--dba-border-card);
      background: var(--dba-surface);
    }

    .bar__brand {
      display: flex;
      flex: none;
      align-items: center;
      gap: 8px;
      text-decoration: none;
    }

    .bar__tag {
      text-transform: uppercase;
    }

    .bar__nav {
      display: flex;
      flex: 1;
      align-self: stretch;
      min-width: 0;
      gap: 4px;
      overflow: hidden;
    }

    .bar__link {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      padding: 0 10px;
      font-size: var(--dba-text-body);
      font-weight: 500;
      color: #5b5870;
      text-decoration: none;
      white-space: nowrap;
    }

    .bar__link::after {
      content: '';
      position: absolute;
      inset: auto 10px 0;
      height: 2px;
      background: transparent;
    }

    .bar__link:hover {
      color: var(--dba-ink);
    }

    .bar__link:focus-visible {
      outline: none;
      color: var(--dba-ink);
      box-shadow: inset 0 0 0 2px var(--dba-focus-halo);
    }

    .bar__link--on {
      font-weight: 600;
      color: var(--dba-ink);
    }

    .bar__link--on::after {
      background: var(--dba-violet-500);
    }

    .bar__label {
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .bar__count {
      padding: 1px 6px;
      border-radius: var(--dba-radius-key);
      background: var(--dba-surface-chip);
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-eyebrow);
      font-weight: 600;
      color: var(--dba-text-muted);
    }

    .bar__link--on .bar__count {
      background: var(--dba-violet-100);
      color: var(--dba-violet-700);
    }

    .bar__tools {
      display: flex;
      flex: none;
      align-items: center;
      gap: 12px;
    }

    .bar__search {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 230px;
      height: var(--dba-height-search);
      padding: 0 10px;
      border: 0;
      border-radius: var(--dba-radius-control);
      background: var(--dba-surface-chip);
      font-family: var(--dba-font-ui);
      color: var(--dba-text-muted);
      cursor: pointer;
    }

    .bar__search:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .bar__searchText {
      flex: 1;
      font-size: var(--dba-text-cell);
      text-align: left;
      white-space: nowrap;
    }

    .bar__kbd {
      padding: 1px 5px;
      border: 1px solid var(--dba-border-control);
      border-radius: var(--dba-radius-key);
      background: var(--dba-surface);
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-eyebrow);
      color: var(--dba-text-muted);
    }

    .bar__avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border: 0;
      border-radius: var(--dba-radius-pill);
      background: var(--dba-ink);
      font-family: var(--dba-font-ui);
      font-size: var(--dba-text-meta);
      font-weight: 700;
      color: var(--dba-surface);
      cursor: pointer;
    }

    .bar__avatar:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--dba-focus-halo);
    }

    .bar__enter {
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-violet-700);
      text-decoration: none;
    }

    .crumbs {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 20px var(--dba-grid-margin);
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-eyebrow);
      letter-spacing: var(--dba-tracking-th);
      text-transform: uppercase;
      color: var(--dba-text-muted);
    }

    .crumbs__item--last {
      color: var(--dba-ink);
    }

    .main {
      flex: 1;
      min-width: 0;
      padding: 0 var(--dba-grid-margin) var(--dba-grid-margin);
    }

    @media (max-width: 960px) {
      .bar__search {
        width: var(--dba-height-search);
        padding: 0;
        justify-content: center;
      }

      .bar__searchText,
      .bar__kbd {
        display: none;
      }
    }

    @media (max-width: 760px) {
      .bar {
        flex-wrap: wrap;
        height: auto;
        gap: 10px;
        padding: 10px 12px;
      }

      .bar__brand {
        order: 1;
      }

      .bar__tools {
        order: 2;
        margin-left: auto;
        gap: 8px;
      }

      .bar__nav {
        order: 3;
        flex-basis: 100%;
        gap: 2px;
        overflow-x: auto;
        scrollbar-width: none;
      }

      .bar__link {
        flex: none;
        padding: 6px 10px 8px;
      }

      .bar__tag {
        display: none;
      }

      .crumbs,
      .main {
        padding-left: 16px;
        padding-right: 16px;
      }
    }
  `,
})
export class ConsoleShellComponent {
  protected readonly auth = inject(AuthStore);
  protected readonly env = inject(APP_ENV);
  protected readonly loginRoute = LOGIN_ROUTE;
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly navCounts = inject(NavCounts);
  protected readonly density = inject(DensityService);

  protected readonly accountMenu = viewChild<Menu>('account');
  protected readonly searchOpen = signal(false);
  protected readonly counts = this.navCounts.counts;

  protected readonly entries = computed(() => {
    const owned = this.auth.platformPermissions();
    return CONSOLE_ENTRIES.filter((entry) => canSeeArea(owned, entry.key));
  });

  protected readonly crumbs = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => titleKeysOf(this.router.routerState.snapshot.root)),
    ),
    { initialValue: titleKeysOf(this.router.routerState.snapshot.root) },
  );

  private readonly logoutLabel = toSignal(this.translate.stream('shell.logout'), { initialValue: '' });

  private readonly densityLabel = computed(() =>
    this.translate.instant(this.density.compact() ? 'shell.densityCozy' : 'shell.densityCompact'),
  );

  protected readonly accountItems = computed<MenuItem[]>(() => [
    { label: this.auth.displayName(), disabled: true },
    { separator: true },
    { label: this.densityLabel() as string, icon: 'pi pi-bars', command: () => this.density.toggle() },
    { separator: true },
    { label: this.logoutLabel() as string, icon: 'pi pi-sign-out', command: () => void this.session.logout() },
  ]);

  protected openSearch(): void {
    this.searchOpen.set(true);
  }

  protected onKey(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.searchOpen.update((open) => !open);
    }
  }
}

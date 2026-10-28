import { ChangeDetectionStrategy, Component, computed, input, output, signal, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Popover } from 'primeng/popover';
import { IconComponent } from './icon.component';

export interface NavGroupLink {
  key: string;
  labelKey: string;
  path: string;
  count?: number;
}

@Component({
  selector: 'dba-nav-group',
  imports: [RouterLink, RouterLinkActive, TranslatePipe, Popover, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variant() === 'bar') {
      <button
        #trigger
        type="button"
        class="trigger"
        [class.trigger--on]="active()"
        aria-haspopup="true"
        [attr.aria-expanded]="open()"
        (click)="panel.toggle($event, trigger)"
      >
        <span class="trigger__label">{{ labelKey() | translate }}</span>
        @if (total()) {
          <code class="count">{{ total() }}</code>
        }
        <db-icon class="trigger__chevron" [class.trigger__chevron--open]="open()" name="chevronDown" [size]="12" />
      </button>
      <p-popover #panel styleClass="dba-nav-pop" (onShow)="open.set(true)" (onHide)="open.set(false)">
        <ul class="list" [attr.aria-label]="labelKey() | translate">
          @for (link of links(); track link.key) {
            <li>
              <a
                class="link"
                [routerLink]="link.path"
                routerLinkActive="link--on"
                #pop="routerLinkActive"
                [attr.aria-current]="pop.isActive ? 'page' : null"
                (click)="pick()"
              >
                <span class="link__label">{{ link.labelKey | translate }}</span>
                @if (link.count) {
                  <code class="count">{{ link.count }}</code>
                }
              </a>
            </li>
          }
        </ul>
      </p-popover>
    } @else {
      <p class="dba-eyebrow heading" [class.heading--on]="active()">{{ labelKey() | translate }}</p>
      <ul class="list list--drawer" [attr.aria-label]="labelKey() | translate">
        @for (link of links(); track link.key) {
          <li>
            <a
              class="link link--drawer"
              [routerLink]="link.path"
              routerLinkActive="link--on"
              #drawer="routerLinkActive"
              [attr.aria-current]="drawer.isActive ? 'page' : null"
              (click)="pick()"
            >
              <span class="link__label">{{ link.labelKey | translate }}</span>
              @if (link.count) {
                <code class="count">{{ link.count }}</code>
              }
            </a>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: contents;
    }

    .trigger {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      padding: 0 10px;
      border: 0;
      background: transparent;
      font-family: var(--dba-font-ui);
      font-size: var(--dba-text-body);
      font-weight: 500;
      color: var(--dba-text-muted);
      white-space: nowrap;
      cursor: pointer;
    }

    .trigger::after {
      content: '';
      position: absolute;
      inset: auto 10px 0;
      height: 2px;
      background: transparent;
    }

    .trigger:hover,
    .trigger[aria-expanded='true'] {
      color: var(--dba-ink);
    }

    .trigger:focus-visible {
      outline: none;
      color: var(--dba-ink);
      box-shadow: inset 0 0 0 2px var(--dba-focus-halo);
    }

    .trigger--on {
      font-weight: 600;
      color: var(--dba-ink);
    }

    .trigger--on::after {
      background: var(--dba-violet-500);
    }

    .trigger__label {
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .trigger__chevron {
      color: var(--dba-text-faint);
      transition: transform 0.15s;
    }

    .trigger__chevron--open {
      transform: rotate(180deg);
    }

    .list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 220px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .link {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      height: 36px;
      padding: 0 10px;
      border-radius: var(--dba-radius-control);
      font-family: var(--dba-font-ui);
      font-size: var(--dba-text-cell);
      font-weight: 500;
      color: var(--dba-text);
      text-decoration: none;
      white-space: nowrap;
    }

    .link:hover {
      background: var(--dba-surface-hover);
      color: var(--dba-ink);
    }

    .link:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px var(--dba-focus-halo);
    }

    .link--on {
      background: var(--dba-violet-100);
      font-weight: 600;
      color: var(--dba-violet-700);
    }

    .link--drawer {
      height: 44px;
      padding: 0 12px;
      font-size: var(--dba-text-field);
    }

    .heading {
      margin: 14px 12px 4px;
      color: var(--dba-text-muted);
    }

    .heading--on {
      color: var(--dba-violet-700);
    }

    .count {
      padding: 1px 6px;
      border-radius: var(--dba-radius-key);
      background: var(--dba-surface-chip);
      font-family: var(--dba-font-mono);
      font-size: var(--dba-text-eyebrow);
      font-weight: 600;
      color: var(--dba-text-muted);
    }

    .trigger--on .count,
    .link--on .count {
      background: var(--dba-violet-100);
      color: var(--dba-violet-700);
    }
  `,
})
export class NavGroupComponent {
  readonly labelKey = input.required<string>();
  readonly links = input.required<readonly NavGroupLink[]>();
  readonly active = input(false);
  readonly variant = input<'bar' | 'drawer'>('bar');
  readonly navigated = output<void>();

  private readonly panel = viewChild<Popover>('panel');
  protected readonly open = signal(false);
  protected readonly total = computed(() => this.links().reduce((sum, link) => sum + (link.count ?? 0), 0));

  protected pick(): void {
    this.panel()?.hide();
    this.navigated.emit();
  }
}

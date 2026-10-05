import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent, type IconName } from './icon.component';
import { LoaderComponent } from './loader.component';

@Component({
  selector: 'db-busy-icon',
  imports: [IconComponent, LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (busy()) {
      <db-loader class="busy__loader" [size]="px()" />
    } @else if (icon(); as name) {
      <db-icon [name]="name" [size]="size()" />
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
    }

    .busy__loader {
      --ld-ink: currentColor;
      display: inline-flex;
    }
  `,
})
export class BusyIconComponent {
  readonly busy = input(false);
  readonly icon = input<IconName | null>(null);
  readonly size = input(16);
  protected readonly px = computed(() => `${this.size()}px`);
}

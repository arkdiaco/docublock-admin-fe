import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LoaderComponent } from './loader.component';

@Component({
  selector: 'db-section-loader',
  imports: [LoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-busy': 'true' },
  template: `<db-loader [size]="size()" [label]="label()" />`,
  styles: `
    :host {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: var(--section-loader-min, 0);
      padding: var(--section-loader-pad, 48px 16px);
      text-align: center;
    }
  `,
})
export class SectionLoaderComponent {
  readonly label = input('');
  readonly size = input('48px');
}

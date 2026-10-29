import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AppUpdate } from './app-update.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'db-app-update-bar',
  imports: [TranslatePipe],
  template: `
    @if (update.available()) {
      <div class="upd" role="status">
        <span class="upd__text">{{ 'app.update.text' | translate }}</span>
        <button type="button" class="upd__cta" (click)="update.apply()">{{ 'app.update.cta' | translate }}</button>
      </div>
    }
  `,
  styles: `
    .upd {
      position: fixed;
      top: calc(env(safe-area-inset-top, 0px) + 12px);
      left: 50%;
      transform: translateX(-50%);
      z-index: 2000;
      display: flex;
      align-items: center;
      gap: 12px;
      width: max-content;
      max-width: calc(100vw - 32px);
      padding: 8px 8px 8px 16px;
      border-radius: 999px;
      background: var(--dba-surface);
      box-shadow: 0 6px 24px rgb(31 20 71 / 18%);
      font-family: var(--dba-font-ui);
      font-size: 14px;
      color: var(--dba-ink);
    }
    .upd__text {
      min-width: 0;
    }
    @media (max-width: 480px) {
      .upd {
        left: 16px;
        right: 16px;
        transform: none;
        width: auto;
        justify-content: space-between;
        border-radius: 16px;
        padding: 10px 10px 10px 14px;
      }
    }
    .upd__cta {
      flex: none;
      border: 0;
      border-radius: 999px;
      padding: 6px 14px;
      background: var(--dba-violet-500);
      color: var(--dba-on-primary);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    .upd__cta:hover {
      background: var(--dba-violet-600);
    }
  `,
})
export class AppUpdateBarComponent {
  protected readonly update = inject(AppUpdate);
}

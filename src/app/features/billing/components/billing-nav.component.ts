import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { sectionPath } from '../../../core/layout/console-nav';
import {
  UnderlineTabsComponent,
  type UnderlineTab,
} from '../../../shared/ui/underline-tabs.component';

export type BillingSection = 'transactions' | 'invoices' | 'revenue';

@Component({
  selector: 'dba-billing-nav',
  imports: [TranslatePipe, UnderlineTabsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="bn">
      <div class="bn__title">
        <h1 class="dba-page">{{ 'nav.billing' | translate }}</h1>
        @if (meta()) {
          <span class="dba-meta">{{ meta() }}</span>
        }
      </div>
      <div class="bn__actions"><ng-content /></div>
    </header>
    <db-underline-tabs [tabs]="tabs()" [active]="active()" [label]="'nav.billing' | translate" />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .bn {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .bn__title {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .bn__actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
  `,
})
export class BillingNavComponent {
  private readonly translate = inject(TranslateService);
  private readonly base = sectionPath('billing');

  readonly active = input.required<BillingSection>();
  readonly meta = input('');

  protected readonly tabs = computed<UnderlineTab[]>(() => [
    {
      key: 'transactions',
      label: this.translate.instant('billing.section.transactions') as string,
      link: this.base,
    },
    {
      key: 'invoices',
      label: this.translate.instant('billing.section.invoices') as string,
      link: [this.base, 'facturas'],
    },
    {
      key: 'revenue',
      label: this.translate.instant('billing.section.revenue') as string,
      link: [this.base, 'ingresos'],
    },
  ]);
}

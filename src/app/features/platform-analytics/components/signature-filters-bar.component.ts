import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import type { LookupScope } from '../../../shared/http/organization-lookup';
import { FieldComponent } from '../../../shared/ui/field.component';
import { FilterPillsComponent, type FilterPill } from '../../../shared/ui/filter-pills.component';
import { OrgPickerComponent } from '../../../shared/ui/org-picker.component';
import {
  SIGNATURE_CHANNEL_KEYS,
  SIGNATURE_PERIODS,
  type SignatureFilters,
} from '../data/signature-filters';

const CHANNEL_PILLS: FilterPill[] = SIGNATURE_CHANNEL_KEYS.map((key) => ({
  key,
  labelKey: `pan.channel.${key}`,
}));

@Component({
  selector: 'dba-signature-filters-bar',
  imports: [
    FormsModule,
    TranslatePipe,
    Select,
    FieldComponent,
    FilterPillsComponent,
    OrgPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bl__tools">
      <div class="sf__control">
        <label class="sf__label" for="pan-period">{{ 'pan.period.label' | translate }}</label>
        <p-select
          inputId="pan-period"
          [options]="periodOptions()"
          optionLabel="label"
          optionValue="id"
          [ngModel]="filters().period"
          (ngModelChange)="changed.emit({ period: $event })"
          appendTo="body"
          styleClass="bl__select"
        />
      </div>
      @if (filters().period === 'personalizado') {
        <dba-field
          class="bl__date"
          label="pan.from"
          type="date"
          [value]="filters().from ?? ''"
          (valueChange)="changed.emit({ from: $event || null })"
        />
        <dba-field
          class="bl__date"
          label="pan.to"
          type="date"
          [value]="filters().to ?? ''"
          (valueChange)="changed.emit({ to: $event || null })"
        />
      }
      @if (pickerScope(); as scope) {
        <dba-org-picker
          [scope]="scope"
          [value]="filters().organizationId"
          (picked)="changed.emit({ organizationId: $event })"
        />
      }
      <db-filter-pills
        [pills]="channelPills"
        [active]="filters().channel"
        [label]="'pan.channel.label' | translate"
        (activeChange)="changed.emit({ channel: $any($event) })"
      />
    </div>
  `,
  styleUrl: '../../../shared/ui/list-page.scss',
  styles: `
    .sf__control {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 0 1 200px;
      min-width: 0;
    }

    .sf__label {
      font-size: var(--dba-text-label);
      font-weight: 600;
      color: var(--dba-text);
    }

    :host ::ng-deep .sf__control .bl__select.p-select {
      flex: 0 0 auto;
      width: 100%;
      max-width: 100%;
    }

    db-filter-pills {
      align-self: center;
    }

    @media (max-width: 520px) {
      .sf__control {
        flex-basis: 100%;
      }
    }
  `,
})
export class SignatureFiltersBarComponent {
  private readonly translate = inject(TranslateService);

  readonly filters = input.required<SignatureFilters>();
  readonly pickerScope = input<LookupScope | null>(null);
  readonly changed = output<Partial<SignatureFilters>>();

  protected readonly channelPills = CHANNEL_PILLS;

  protected readonly periodOptions = computed(() =>
    SIGNATURE_PERIODS.map((id) => ({
      id,
      label: this.translate.instant(`pan.period.${id}`) as string,
    })),
  );
}
